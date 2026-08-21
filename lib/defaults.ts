import type { AppData, PlannerConfig, ProteinTargets } from "./types";

export const ALL_FOLDER_ID = "all";

export const defaultFolders = [
  { id: "favorites", label: "Favorites", icon: "❤️", order: 0 },
  { id: "weeknight", label: "Weeknight Dinners", icon: "🌙", order: 1 },
  { id: "weekend", label: "Weekend Projects", icon: "☀️", order: 2 },
  { id: "baking", label: "Baking", icon: "🥐", order: 3 },
  { id: "meal-prep", label: "Meal Prep", icon: "🥡", order: 4 },
];

export const defaultAppData: AppData = {
  recipes: [],
  labels: [],
  folders: defaultFolders,
  plannerConfig: null,  // null triggers onboarding intercept
  mealPlan: null,
  cookLog: [],
};

export const defaultProteinTargets: ProteinTargets = {
  poultry: 2,
  "fish-seafood": 1,
  "red-meat": 1,
  pork: 0,
  vegetarianVegan: 1,
};

/**
 * Backfills any missing protein-target keys with 0. Protects against fields
 * added after some users already had a saved PlannerConfig (e.g. `pork`) —
 * without this, arithmetic over an incomplete ProteinTargets produces NaN.
 */
export function normalizeProteinTargets(
  targets: Partial<ProteinTargets> | undefined | null,
): ProteinTargets {
  return {
    poultry: targets?.poultry ?? 0,
    "fish-seafood": targets?.["fish-seafood"] ?? 0,
    "red-meat": targets?.["red-meat"] ?? 0,
    pork: targets?.pork ?? 0,
    vegetarianVegan: targets?.vegetarianVegan ?? 0,
  };
}

export function normalizePlannerConfig(
  config: PlannerConfig | null | undefined,
): PlannerConfig | null {
  if (!config) return null;
  return {
    ...config,
    proteinTargets: normalizeProteinTargets(config.proteinTargets),
  };
}