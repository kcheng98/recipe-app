import type { ImportedRecipe, Recipe, RecipeDraft } from "./types";
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
    supportedStores: ["Standard"],
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

export async function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
