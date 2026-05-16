import type { ImportedRecipe } from "./types";

/** Symbols often copied from blog recipe checkboxes / bullets. */
const JUNK_SYMBOLS =
  /[\u25A0-\u25AF\u2610-\u2612\u2713-\u2717\u25C6\u25C7▢☐☑✓✔✗□■●○◦•·▪▫◻◼⬜⬛]/gu;

export function cleanRecipeLine(line: string): string {
  return line
    .replace(JUNK_SYMBOLS, "")
    .replace(/^\s*[\d]+[.)]\s*/, "") // leading "1." from lists
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanRecipeBlock(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => cleanRecipeLine(line))
    .filter(Boolean)
    .join("\n");
}

export function cleanImportedRecipe(recipe: ImportedRecipe): ImportedRecipe {
  return {
    ...recipe,
    title: cleanRecipeLine(recipe.title ?? ""),
    description: cleanRecipeLine(recipe.description ?? ""),
    ingredients: cleanRecipeBlock(recipe.ingredients ?? ""),
    instructions: cleanRecipeBlock(recipe.instructions ?? ""),
    prepTime: cleanRecipeLine(recipe.prepTime ?? ""),
    cookTime: cleanRecipeLine(recipe.cookTime ?? ""),
    totalTime: cleanRecipeLine(recipe.totalTime ?? ""),
    yields: cleanRecipeLine(recipe.yields ?? ""),
  };
}
