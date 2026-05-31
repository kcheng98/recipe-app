/**
 * lib/planner/algorithm.ts
 *
 * 3-stage meal plan generation engine.
 *
 * Stage 1 — Hard filters
 *   • Remove recipes whose vibe conflicts with current season (weather.ts)
 *   • Remove recipes that require a store tier the user hasn't enabled
 *
 * Stage 2 — Scoring  (applied to each candidate independently)
 *   • Base score:            0
 *   • Recency bonus:        +20  if lastCookedAt is > 30 days ago OR never
 *   • Recency penalty:     -100  if lastCookedAt is < 14 days ago
 *   • Store exclusion:     -100  if ANY required store tier is NOT enabled
 *     (belt-and-suspenders; hard filter above already removes these, but this
 *      prevents accidents if the filter is bypassed)
 *   • Asian batching bonus: +30  if recipe requires "Asian" store AND at least
 *     one other already-selected recipe also requires "Asian" store
 *     (rewards batching the Asian grocery run into a single trip)
 *
 * Stage 3 — Bucket allocation
 *   • Group candidates by protein bucket:
 *       poultry | fish-seafood | red-meat | vegetarianVegan (vegetarian + vegan)
 *   • For each bucket, fill up to the target count from PlannerConfig.
 *   • Within a bucket, pick from the weighted top-3 (scores → weights, then
 *     weighted random without replacement).
 *   • Locked slots are respected — their protein type counts against the target.
 */

import type { MealPlan, MealSlot, PlannerConfig, ProteinType, Recipe } from "@/lib/types";
import { getSeasonalVibe } from "./weather";

// ─── Scoring constants ────────────────────────────────────────────────────────

const RECENCY_BONUS = 40;       // never cooked gets extra boost
const RECENCY_PENALTY = -40;    // recently cooked softly deprioritised
const STORE_PENALTY = -100;     // required store not enabled (safety net)
const ASIAN_BATCH_BONUS = 30;   // second+ Asian-store recipe in the same plan

const RECENCY_BONUS_DAYS = 30;
const RECENCY_PENALTY_DAYS = 7;

// ─── Types ────────────────────────────────────────────────────────────────────

type ProteinBucket = "poultry" | "fish-seafood" | "red-meat" | "vegetarianVegan";

function toBucket(pt: ProteinType): ProteinBucket | null {
  if (pt === "poultry") return "poultry";
  if (pt === "fish-seafood") return "fish-seafood";
  if (pt === "red-meat") return "red-meat";
  if (pt === "vegetarian" || pt === "vegan") return "vegetarianVegan";
  return null; // "none" — excluded from bucket allocation
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(isoTimestamp: string): number {
  const ms = Date.now() - new Date(isoTimestamp).getTime();
  return ms / (1000 * 60 * 60 * 24);
}

/**
 * Generate an ordered list of ISO date strings (YYYY-MM-DD) starting from
 * weekStart for `count` consecutive days.
 */
function generateDates(weekStart: string, count: number): string[] {
  const dates: string[] = [];
  const base = new Date(weekStart + "T00:00:00");
  for (let i = 0; i < count; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }
  return dates;
}

/**
 * Weighted random pick (without replacement) from an array of [item, weight]
 * pairs. Returns up to `n` items.
 */
export function weightedSample<T>(
  items: { item: T; weight: number }[],
  n: number,
): T[] {
  const pool = items.map(({ item, weight }) => ({
    item,
    weight: Math.max(weight, 1), // floor at 1 so every item has a chance
  }));
  const result: T[] = [];

  for (let i = 0; i < n && pool.length > 0; i++) {
    const total = pool.reduce((sum, p) => sum + p.weight, 0);
    let rand = Math.random() * total;
    let idx = 0;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].weight;
      if (rand <= 0) {
        idx = j;
        break;
      }
    }
    result.push(pool[idx].item);
    pool.splice(idx, 1);
  }

  return result;
}

// ─── Stage 1: Hard filters ────────────────────────────────────────────────────

function hardFilter(recipes: Recipe[], config: PlannerConfig): Recipe[] {
  const seasonalVibe = getSeasonalVibe();

  return recipes.filter((r) => {
    // Vibe filter: remove if recipe vibe conflicts with season
    // "all-weather" passes always; mismatched vibe fails.
    if (r.vibe !== "all-weather" && r.vibe !== seasonalVibe) return false;

    // Store filter: every required store tier must be enabled
    const hasRequiredStore = r.supportedStores.every((tier) =>
      config.enabledStores.includes(tier),
    );
    if (!hasRequiredStore) return false;

    return true;
  });
}

// ─── Stage 2: Scoring ─────────────────────────────────────────────────────────

export function scoreRecipe(
  recipe: Recipe,
  config: PlannerConfig,
  /** IDs of recipes already selected so far (for Asian batch bonus) */
  selectedRecipes: Recipe[],
): number {
  let score = 0;

  // Recency
  if (recipe.lastCookedAt === null) {
    score += RECENCY_BONUS; // never cooked — strongest boost
  } else {
    const days = daysSince(recipe.lastCookedAt);
    if (days > RECENCY_BONUS_DAYS) score += RECENCY_BONUS / 2; // cooked > 30 days: mild boost
    else if (days < RECENCY_PENALTY_DAYS) score += RECENCY_PENALTY; // cooked < 7 days: soft downweight
    // between 7–30 days: neutral
  }

  // Store penalty safety net
  const hasAllStores = recipe.supportedStores.every((tier) =>
    config.enabledStores.includes(tier),
  );
  if (!hasAllStores) score += STORE_PENALTY;

  // Asian batching bonus: applies when this recipe needs Asian market AND
  // at least one already-selected recipe also needs Asian market.
  if (recipe.supportedStores.includes("Asian")) {
    const alreadyHasAsian = selectedRecipes.some((r) =>
      r.supportedStores.includes("Asian"),
    );
    if (alreadyHasAsian) score += ASIAN_BATCH_BONUS;
  }

  return score;
}

// ─── Stage 3: Bucket allocation ───────────────────────────────────────────────
function allocateBuckets(
  candidates: Recipe[],
  config: PlannerConfig,
  lockedByDate: Record<string, string | null>,
  lockedRecipes: Recipe[],
  dates: string[],
  excluded: Set<string>,
): Map<string, Recipe | null> {
  // Start with what's already locked
  const assignments = new Map<string, Recipe | null>();
  for (const [date, recipeId] of Object.entries(lockedByDate)) {
    const r = recipeId
      ? lockedRecipes.find((lr) => lr.id === recipeId) ?? null
      : null;
    assignments.set(date, r);
  }

  // Count how many of each bucket are already satisfied by locked slots
  const remaining: Record<ProteinBucket, number> = {
    poultry: config.proteinTargets.poultry,
    "fish-seafood": config.proteinTargets["fish-seafood"],
    "red-meat": config.proteinTargets["red-meat"],
    vegetarianVegan: config.proteinTargets.vegetarianVegan,
  };

  for (const r of lockedRecipes) {
    const bucket = toBucket(r.proteinType);
    if (bucket && remaining[bucket] > 0) remaining[bucket]--;
  }

  // Dates that still need assignment (not locked)
  const openDates = dates.filter((d) => !lockedByDate[d]);

  // Filter out excluded recipes
  const pool = candidates.filter((r) => !excluded.has(r.id));

  // Build per-bucket pools
  const bucketPools: Record<ProteinBucket, Recipe[]> = {
    poultry: pool.filter((r) => toBucket(r.proteinType) === "poultry"),
    "fish-seafood": pool.filter((r) => toBucket(r.proteinType) === "fish-seafood"),
    "red-meat": pool.filter((r) => toBucket(r.proteinType) === "red-meat"),
    vegetarianVegan: pool.filter(
      (r) => r.proteinType === "vegetarian" || r.proteinType === "vegan",
    ),
  };

  // Already-selected recipes (for Asian batch bonus in scoring)
  const selected: Recipe[] = [...lockedRecipes];

  // For each bucket in order, score and pick
  const bucketOrder: ProteinBucket[] = [
    "poultry",
    "fish-seafood",
    "red-meat",
    "vegetarianVegan",
  ];

  const picks: Recipe[] = [];
  const usedIds = new Set(lockedRecipes.map((r) => r.id));

  for (const bucket of bucketOrder) {
    const target = remaining[bucket];
    if (target <= 0) continue;

    const bucketCandidates = bucketPools[bucket].filter((r) => !usedIds.has(r.id));

    // Score each candidate in the context of already-selected recipes
    const scored = bucketCandidates
      .map((r) => ({ item: r, weight: scoreRecipe(r, config, selected) + 200 }))
      // +200 offset ensures weights stay positive even after penalties
      .sort((a, b) => b.weight - a.weight);

    const chosen = weightedSample(scored, target);

    for (const r of chosen) {
      usedIds.add(r.id);
      selected.push(r);
      picks.push(r);
    }
  }

  // Shuffle picks before assigning to dates so the protein sequence varies
  // week-over-week (e.g. poultry doesn't always land on the first open day).
  const shuffledPicks = [...picks];
  for (let i = shuffledPicks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledPicks[i], shuffledPicks[j]] = [shuffledPicks[j], shuffledPicks[i]];
  }

  let pickIdx = 0;
  for (const date of openDates) {
    if (pickIdx < shuffledPicks.length) {
      assignments.set(date, shuffledPicks[pickIdx]);
    } else {
      // NEW RANDOMIZED FALLBACK CODE
      // Fallback: Filter down to ONLY the recipes we haven't used yet this week
      const unusedPool = pool.filter((r) => !usedIds.has(r.id));
      
      // Pick a random index from that unused pool, or default to null if completely empty
      const fallback = unusedPool.length > 0 
        ? unusedPool[Math.floor(Math.random() * unusedPool.length)] 
        : null;

      if (fallback) usedIds.add(fallback.id);
      assignments.set(date, fallback);
    }
    pickIdx++;
  }

  return assignments;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a fresh MealPlan for the given week.
 *
 * @param weekStart   ISO date string for the Monday of the target week
 * @param config      The user's PlannerConfig
 * @param allRecipes  Full recipe library
 * @param lockedSlots Map of date → recipeId for slots the user has pinned.
 *                    These are copied as-is into the output plan.
 * @param excluded    Optional set of recipe IDs to skip (used by swapSlot)
 */
export function generatePlan(
  weekStart: string,
  config: PlannerConfig,
  allRecipes: Recipe[],
  lockedSlots: Record<string, string | null> = {},
  excluded: Set<string> = new Set(),
): MealPlan {
  const dates = generateDates(weekStart, config.daysPerWeek);

  // Stage 1
  const candidates = hardFilter(allRecipes, config);

  // Resolve locked recipes (need the full Recipe objects for scoring context)
  const lockedRecipes: Recipe[] = [];
  for (const recipeId of Object.values(lockedSlots)) {
    if (!recipeId) continue;
    const r = allRecipes.find((r) => r.id === recipeId);
    if (r) lockedRecipes.push(r);
  }

  // Stage 3 (scoring is embedded per-recipe inside allocateBuckets)
  const assignments = allocateBuckets(
    candidates,
    config,
    lockedSlots,
    lockedRecipes,
    dates,
    excluded,
  );

  // Build the MealSlot array
  const slots: MealSlot[] = dates.map((date) => {
    const recipe = assignments.get(date) ?? null;
    const isLocked = date in lockedSlots;
    return {
      date,
      recipeId: recipe?.id ?? null,
      isLocked,
      status: recipe ? "pending" : "untracked",
    };
  });

  return { weekStart, slots };
}
