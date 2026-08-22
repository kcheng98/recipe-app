import type { CookEvent, ProteinType, Recipe } from "./types";

/**
 * Aggregation helpers for Kitchen Wrapped. Pure functions over the cook log
 * — no React, no app state — so they're easy to reason about and test in
 * isolation from the page that renders them.
 *
 * The cook log only exists from whenever this feature shipped onward (see
 * CookEvent in lib/types.ts) — there's no way to reconstruct history from
 * before that, since the only thing previously persisted per recipe was a
 * single lastCookedAt timestamp, overwritten on every cook.
 */

// ─── Period keys ────────────────────────────────────────────────────────────

/** "2026-08" */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** "2026" */
export function yearKey(iso: string): string {
  return iso.slice(0, 4);
}

export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function currentYearKey(now: Date = new Date()): string {
  return String(now.getFullYear());
}

/** Shift a "YYYY-MM" key by `delta` months (negative goes back). */
export function shiftMonthKey(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function previousYearKey(key: string): string {
  return String(Number(key) - 1);
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

// ─── Filtering ───────────────────────────────────────────────────────────────

export function eventsInMonth(events: CookEvent[], key: string): CookEvent[] {
  return events.filter((e) => monthKey(e.cookedAt) === key);
}

export function eventsInYear(events: CookEvent[], key: string): CookEvent[] {
  return events.filter((e) => yearKey(e.cookedAt) === key);
}

// ─── Rankings ────────────────────────────────────────────────────────────────

export type RankedMeal = {
  recipeId: string;
  recipeTitle: string;
  proteinType: ProteinType;
  count: number;
  lastCookedAt: string;
  /** Live lookup — null if the recipe has since been deleted. */
  recipe: Recipe | null;
};

/** Ranks recipes by how many times they were cooked, most first. */
export function rankMeals(events: CookEvent[], recipes: Recipe[]): RankedMeal[] {
  const byRecipe = new Map<
    string,
    { title: string; proteinType: ProteinType; count: number; lastCookedAt: string }
  >();

  for (const e of events) {
    const existing = byRecipe.get(e.recipeId);
    if (existing) {
      existing.count += 1;
      if (e.cookedAt > existing.lastCookedAt) existing.lastCookedAt = e.cookedAt;
    } else {
      byRecipe.set(e.recipeId, {
        title: e.recipeTitle,
        proteinType: e.proteinType,
        count: 1,
        lastCookedAt: e.cookedAt,
      });
    }
  }

  const recipeById = new Map(recipes.map((r) => [r.id, r]));

  return Array.from(byRecipe.entries())
    .map(([recipeId, v]) => ({
      recipeId,
      recipeTitle: v.title,
      proteinType: v.proteinType,
      count: v.count,
      lastCookedAt: v.lastCookedAt,
      recipe: recipeById.get(recipeId) ?? null,
    }))
    .sort((a, b) => b.count - a.count || b.lastCookedAt.localeCompare(a.lastCookedAt));
}

/** Same ranking, grouped by the recipe's current folder. Deleted recipes (no
 * live folder to group by) are omitted — they still count everywhere else. */
export function rankMealsByFolder(
  events: CookEvent[],
  recipes: Recipe[],
): Map<string, RankedMeal[]> {
  const ranked = rankMeals(events, recipes).filter((m) => m.recipe !== null);
  const byFolder = new Map<string, RankedMeal[]>();
  for (const meal of ranked) {
    const folderId = meal.recipe!.folderId;
    const list = byFolder.get(folderId) ?? [];
    list.push(meal);
    byFolder.set(folderId, list);
  }
  return byFolder;
}

// ─── Protein mix ─────────────────────────────────────────────────────────────

export type ProteinSlice = { proteinType: ProteinType; count: number; pct: number };

const PROTEIN_ORDER: ProteinType[] = [
  "poultry",
  "red-meat",
  "pork",
  "fish-seafood",
  "vegetarian",
  "vegan",
  "none",
];

/** Fixed, consistent category order (not sorted by count) so the same
 * protein always renders in the same position/color across periods. */
export function proteinMix(events: CookEvent[]): ProteinSlice[] {
  const counts = new Map<ProteinType, number>();
  for (const e of events) counts.set(e.proteinType, (counts.get(e.proteinType) ?? 0) + 1);
  const total = events.length;

  return PROTEIN_ORDER.filter((p) => counts.has(p)).map((proteinType) => {
    const count = counts.get(proteinType) ?? 0;
    return { proteinType, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
}

// ─── Trends ──────────────────────────────────────────────────────────────────

export function busiestMonth(events: CookEvent[]): { month: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const e of events) {
    const k = monthKey(e.cookedAt);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let best: { month: string; count: number } | null = null;
  for (const [month, count] of counts) {
    if (!best || count > best.count) best = { month, count };
  }
  return best;
}

// ─── First-cook / "new to the rotation" ──────────────────────────────────────

function firstCookDates(allEvents: CookEvent[]): Map<string, string> {
  const first = new Map<string, string>();
  for (const e of allEvents) {
    const cur = first.get(e.recipeId);
    if (!cur || e.cookedAt < cur) first.set(e.recipeId, e.cookedAt);
  }
  return first;
}

/** Recipes whose very first-ever cook falls within [periodStart, periodEnd). */
export function newToRotation(
  allEvents: CookEvent[],
  periodStart: string,
  periodEnd: string,
  recipes: Recipe[],
): RankedMeal[] {
  const first = firstCookDates(allEvents);
  const newIds = new Set(
    Array.from(first.entries())
      .filter(([, date]) => date >= periodStart && date < periodEnd)
      .map(([id]) => id),
  );
  const periodEvents = allEvents.filter((e) => newIds.has(e.recipeId) && e.cookedAt >= periodStart && e.cookedAt < periodEnd);
  return rankMeals(periodEvents, recipes);
}

// ─── Comeback meal ───────────────────────────────────────────────────────────

export type ComebackMeal = {
  recipeId: string;
  recipeTitle: string;
  gapDays: number;
  cookedAt: string;
  recipe: Recipe | null;
};

/** The recipe with the longest gap since its previous cook, among cooks that
 * landed within this period. Only considers gaps of at least `minGapDays`,
 * so a recipe cooked twice a month doesn't count as a "comeback." */
export function comebackMeal(
  allEvents: CookEvent[],
  periodStart: string,
  periodEnd: string,
  recipes: Recipe[],
  minGapDays = 60,
): ComebackMeal | null {
  const byRecipe = new Map<string, CookEvent[]>();
  for (const e of allEvents) {
    const arr = byRecipe.get(e.recipeId) ?? [];
    arr.push(e);
    byRecipe.set(e.recipeId, arr);
  }

  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  let best: ComebackMeal & { gapDays: number } | null = null;

  for (const [recipeId, evs] of byRecipe) {
    const sorted = [...evs].sort((a, b) => a.cookedAt.localeCompare(b.cookedAt));
    for (let i = 1; i < sorted.length; i++) {
      const cur = sorted[i];
      if (cur.cookedAt < periodStart || cur.cookedAt >= periodEnd) continue;
      const prevEvent = sorted[i - 1];
      const gapDays = Math.round(
        (new Date(cur.cookedAt).getTime() - new Date(prevEvent.cookedAt).getTime()) / 86_400_000,
      );
      if (gapDays >= minGapDays && (!best || gapDays > best.gapDays)) {
        best = {
          recipeId,
          recipeTitle: cur.recipeTitle,
          gapDays,
          cookedAt: cur.cookedAt,
          recipe: recipeById.get(recipeId) ?? null,
        };
      }
    }
  }

  return best;
}

// ─── One-and-done vs. regulars (library-wide, all-time) ─────────────────────

export type FrequencyBucket = { recipeId: string; recipeTitle: string; count: number; recipe: Recipe | null };

export function cookFrequencyBuckets(
  allEvents: CookEvent[],
  recipes: Recipe[],
  regularThreshold = 3,
): { oneAndDone: FrequencyBucket[]; regulars: FrequencyBucket[] } {
  const ranked = rankMeals(allEvents, recipes);
  return {
    oneAndDone: ranked.filter((m) => m.count === 1),
    regulars: ranked.filter((m) => m.count >= regularThreshold),
  };
}
