import type {
  AppData,
  NutritionConfig,
  PlannerConfig,
  ProteinSource,
  ProteinTargets,
} from "./types";

export const ALL_FOLDER_ID = "all";

export const defaultFolders = [
  { id: "favorites", label: "Favorites", icon: "❤️", order: 0 },
  { id: "weeknight", label: "Weeknight Dinners", icon: "🌙", order: 1 },
  { id: "weekend", label: "Weekend Projects", icon: "☀️", order: 2 },
  { id: "baking", label: "Baking", icon: "🥐", order: 3 },
  { id: "meal-prep", label: "Meal Prep", icon: "🥡", order: 4 },
];

// ─── Protein Math defaults ──────────────────────────────────────────────────
// Seeded from Kenzi & Martin's own reference cheat sheet. Fixed string ids
// (rather than generated ones) since this is a static, module-level default.

const defaultProteinSources: ProteinSource[] = [
  // Poultry
  { id: "protein-chicken-breast", name: "Chicken Breast", category: "poultry", proteinPer100g: 23, basis: "raw", notes: "" },
  { id: "protein-chicken-thighs-bs", name: "Chicken Thighs (Boneless, Skinless)", category: "poultry", proteinPer100g: 20, basis: "raw", notes: "" },
  { id: "protein-chicken-thighs-bisk", name: "Chicken Thighs (Bone-In, Skin-On)", category: "poultry", proteinPer100g: 13, basis: "raw", notes: "Bone + skin weight lowers protein density — expect a bigger raw weight to hit target." },
  { id: "protein-rotisserie-chicken", name: "Rotisserie Chicken", category: "poultry", proteinPer100g: 27, basis: "cooked", notes: "Already cooked — this is a serving weight, not a raw/shopping weight." },
  { id: "protein-ground-chicken-turkey", name: "Ground Chicken / Turkey (93/7)", category: "poultry", proteinPer100g: 22, basis: "raw", notes: "" },
  { id: "protein-other-poultry", name: "All Other Poultry (Catch-All Avg)", category: "poultry", proteinPer100g: 21, basis: "raw", notes: "Average of the other poultry entries above." },

  // Pork
  { id: "protein-pork-tenderloin", name: "Pork Tenderloin", category: "pork", proteinPer100g: 22, basis: "raw", notes: "" },
  { id: "protein-pork-belly", name: "Pork Belly", category: "pork", proteinPer100g: 10, basis: "raw", notes: "High fat content — much lower protein density than leaner cuts." },
  { id: "protein-st-louis-ribs", name: "St. Louis Ribs (Bone-In)", category: "pork", proteinPer100g: 10, basis: "raw", notes: "Bone weight lowers protein density — expect a bigger raw weight to hit target." },
  { id: "protein-ground-pork", name: "Ground Pork", category: "pork", proteinPer100g: 20, basis: "raw", notes: "" },
  { id: "protein-other-pork", name: "All Other Pork (Catch-All Avg)", category: "pork", proteinPer100g: 18, basis: "raw", notes: "Average of the other pork entries above." },

  // Red meat
  { id: "protein-beef-tenderloin", name: "Beef Tenderloin / Filet", category: "red-meat", proteinPer100g: 22, basis: "raw", notes: "" },
  { id: "protein-ribeye", name: "Ribeye Steak (Boneless)", category: "red-meat", proteinPer100g: 20, basis: "raw", notes: "" },
  { id: "protein-ground-lamb", name: "Ground Lamb", category: "red-meat", proteinPer100g: 18, basis: "raw", notes: "" },
  { id: "protein-ground-beef", name: "Ground Beef (80/20)", category: "red-meat", proteinPer100g: 19, basis: "raw", notes: "" },
  { id: "protein-braised-beef-shank", name: "Braised Banana Beef Shank", category: "red-meat", proteinPer100g: 30, basis: "cooked", notes: "Already cooked — this is a serving weight, not a raw/shopping weight." },
  { id: "protein-rack-of-lamb", name: "Rack of Lamb (Bone-In)", category: "red-meat", proteinPer100g: 11, basis: "raw", notes: "Bone weight lowers protein density — expect a bigger raw weight to hit target." },
  { id: "protein-other-red-meat", name: "All Other Beef / Lamb (Catch-All Avg)", category: "red-meat", proteinPer100g: 20, basis: "raw", notes: "Average of the other beef/lamb entries above." },

  // Fish & seafood
  { id: "protein-shrimp", name: "Shrimp (Peeled & Deveined)", category: "fish-seafood", proteinPer100g: 23, basis: "raw", notes: "" },
  { id: "protein-salmon", name: "Salmon Fillet", category: "fish-seafood", proteinPer100g: 20, basis: "raw", notes: "" },
  { id: "protein-cod", name: "Cod Fillet", category: "fish-seafood", proteinPer100g: 20, basis: "raw", notes: "" },
  { id: "protein-ahi-tuna", name: "Ahi Tuna Steak", category: "fish-seafood", proteinPer100g: 24, basis: "raw", notes: "" },
  { id: "protein-other-fish", name: "All Other Fish / Seafood (Catch-All Avg)", category: "fish-seafood", proteinPer100g: 20, basis: "raw", notes: "Average of the other fish/seafood entries above." },

  // Vegetarian
  { id: "protein-tofu", name: "Extra Firm Tofu", category: "vegetarian", proteinPer100g: 10, basis: "raw", notes: "" },
  { id: "protein-chickpeas", name: "Chickpeas", category: "vegetarian", proteinPer100g: 9, basis: "cooked", notes: "Cooked/canned, not dry." },
];

export const defaultNutritionConfig: NutritionConfig = {
  people: [
    { name: "Kenzi", weightKg: 50, gramsPerKg: 0.8 },
    { name: "Martin", weightKg: 80, gramsPerKg: 0.8 },
  ],
  proteins: defaultProteinSources,
};

/**
 * Defends against a malformed/partial NutritionConfig (e.g. an older or
 * hand-edited cloud row) — falls back to the full default rather than
 * letting `.people[0]`/`.people[1]` crash on an unexpected shape.
 */
export function normalizeNutritionConfig(
  config: NutritionConfig | null | undefined,
): NutritionConfig {
  if (!config || !Array.isArray(config.people) || config.people.length !== 2) {
    return defaultNutritionConfig;
  }
  return {
    people: config.people,
    proteins: Array.isArray(config.proteins) ? config.proteins : [],
  };
}

export const defaultAppData: AppData = {
  recipes: [],
  labels: [],
  folders: defaultFolders,
  plannerConfig: null,  // null triggers onboarding intercept
  mealPlan: null,
  cookLog: [],
  nutrition: defaultNutritionConfig,
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