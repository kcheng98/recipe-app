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

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
