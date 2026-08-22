import type { CookEvent, Folder, ImportedRecipe, Recipe, RecipeDraft } from "./types";
import { createId } from "./storage";

export function emptyDraft(folderId: string): RecipeDraft {
  return {
    title: "",
    description: "",
    imageUrl: "",
    prepTime: "",
    cookTime: "",
    totalTime: "",
    yields: "",
    ingredients: "",
    instructions: "",
    notes: "",
    author: "",
    recipeSite: "",
    labelIds: [],
    folderId,
    sourceType: "manual",
    // ── Pillar defaults ──
    proteinType: "none",
    lastCookedAt: null,
    vibe: "all-weather",
  };
}

export function draftFromImport(
  partial: ImportedRecipe,
  folderId: string,
  sourceType: Recipe["sourceType"],
  sourceUrl?: string,
): RecipeDraft {
  return {
    ...emptyDraft(folderId),
    ...partial,
    title: partial.title ?? "Untitled Recipe",
    prepTime: partial.prepTime ?? "",
    cookTime: partial.cookTime ?? "",
    totalTime: partial.totalTime ?? "",
    yields: partial.yields ?? "",
    notes: "",
    author: partial.author ?? "",
    recipeSite: partial.recipeSite ?? "",
    folderId,
    sourceType,
    sourceUrl,
  };
}

export function createRecipe(draft: RecipeDraft): Recipe {
  const now = new Date().toISOString();
  return {
    ...draft,
    id: createId(),
    createdAt: now,
    updatedAt: now,
  };
}

export function updateRecipe(recipe: Recipe, draft: RecipeDraft): Recipe {
  return {
    ...recipe,
    ...draft,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Orders recipes for display: grouped by folder (in the folder list's own
 * current order, so reordering folders reorders recipe groups too), then
 * within each folder group by most-recently-cooked first — never-cooked
 * recipes sort last within their group.
 *
 * `folders` should already be in display order (the `folders` value from
 * useApp() already is).
 */
export function sortRecipesForDisplay(
  recipes: Recipe[],
  folders: Folder[],
): Recipe[] {
  const folderOrder = new Map(folders.map((f, index) => [f.id, index]));
  const orderOf = (folderId: string) =>
    folderOrder.get(folderId) ?? Number.MAX_SAFE_INTEGER;

  return [...recipes].sort((a, b) => {
    const folderDiff = orderOf(a.folderId) - orderOf(b.folderId);
    if (folderDiff !== 0) return folderDiff;

    if (a.lastCookedAt === null && b.lastCookedAt === null) return 0;
    if (a.lastCookedAt === null) return 1; // never-cooked sorts last
    if (b.lastCookedAt === null) return -1;
    return (
      new Date(b.lastCookedAt).getTime() - new Date(a.lastCookedAt).getTime()
    );
  });
}

/**
 * Builds one cook-log entry for Kitchen Wrapped. Called anywhere
 * lastCookedAt gets stamped on a recipe, with the same date. Snapshots the
 * title + protein type so the log stays meaningful even if the recipe is
 * later renamed, re-categorized, or deleted.
 */
export function createCookEvent(recipe: Recipe, cookedAt: string): CookEvent {
  return {
    id: createId(),
    recipeId: recipe.id,
    recipeTitle: recipe.title,
    proteinType: recipe.proteinType,
    cookedAt,
  };
}

/**
 * Appends a cook event, but only if this recipe doesn't already have one
 * logged for the same calendar day. This is the guard against duplicate
 * entries — re-picking the same date in the inline editor (browsers can
 * fire onChange even when the value didn't actually change), a retried
 * save, or re-confirming an already-cooked planner slot should never
 * inflate Kitchen Wrapped's count. One real dinner = at most one log entry
 * per recipe per day.
 */
export function appendCookEventIfNew(
  cookLog: CookEvent[],
  recipe: Recipe,
  cookedAt: string,
): CookEvent[] {
  const dateKey = cookedAt.slice(0, 10);
  const alreadyLogged = cookLog.some(
    (e) => e.recipeId === recipe.id && e.cookedAt.slice(0, 10) === dateKey,
  );
  if (alreadyLogged) return cookLog;
  return [...cookLog, createCookEvent(recipe, cookedAt)];
}

/**
 * Removes any cook-log entries for a recipe that land on the given date.
 * Used when a "last cooked" date is cleared back to "Never" — undoes the
 * log entry (or entries, if the duplicate-logging bug already created more
 * than one) that corresponded to the date being cleared, so a mistaken or
 * test entry doesn't permanently inflate Kitchen Wrapped.
 */
export function removeCookEventsForDate(
  cookLog: CookEvent[],
  recipeId: string,
  dateISO: string | null | undefined,
): CookEvent[] {
  if (!dateISO) return cookLog;
  const dateKey = dateISO.slice(0, 10);
  return cookLog.filter(
    (e) => !(e.recipeId === recipeId && e.cookedAt.slice(0, 10) === dateKey),
  );
}

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
