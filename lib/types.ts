// ─── Existing types ───────────────────────────────────────────────────────────

export type SourceType = "manual" | "url" | "photo" | "pdf";

export type Recipe = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  yields: string;
  ingredients: string;
  instructions: string;
  notes: string;
  author: string;
  recipeSite: string;
  labelIds: string[];
  folderId: string;
  sourceType: SourceType;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;

  // ─── Meal Planner Pillar Fields ──────────────────────────────────────────
  // Pillar A: what protein category this meal belongs to
  proteinType: ProteinType;
  // Pillar B: ISO timestamp of last time this was cooked (null = never)
  lastCookedAt: string | null;
  // Pillar C: seasonal mood/weight of the dish
  vibe: MoodVibe;
};

export type Label = {
  id: string;
  name: string;
};

export type Folder = {
  id: string;
  label: string;
  icon: string;
  order: number;
};

export type AppData = {
  recipes: Recipe[];
  labels: Label[];
  folders: Folder[];
  // Planner config and active week plan live here so they sync across devices
  plannerConfig: PlannerConfig | null;
  mealPlan: MealPlan | null;
  // Append-only cook history, powering Kitchen Wrapped. Every recipe only
  // carries its single most recent lastCookedAt — this is the record of
  // every time, so month/year stats can be reconstructed later.
  cookLog: CookEvent[];
  // Protein Math workspace settings — see the "Protein Math" section below.
  nutrition: NutritionConfig;
};

export type RecipeDraft = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export type ImportedRecipe = Partial<RecipeDraft> & {
  title?: string;
};

// ─── Meal Planner Types ───────────────────────────────────────────────────────

/** Pillar A — protein categories used for weekly distribution balancing */
export type ProteinType =
  | "poultry"
  | "fish-seafood"
  | "red-meat"
  | "pork"
  | "vegetarian"
  | "vegan"
  | "none";

/** Pillar C — seasonal/mood weight of a dish, used for weather filtering */
export type MoodVibe = "light-fresh" | "heavy-rich" | "all-weather";

/**
 * The user's saved planner preferences.
 * Set once during onboarding, editable any time via the "Adjust Planner" modal.
 */
export type PlannerConfig = {
  /** How many days per week to plan meals for (3–7) */
  daysPerWeek: number;

  /**
   * Target protein counts for the week.
   * The values must sum to daysPerWeek.
   * e.g. { poultry: 2, "fish-seafood": 1, "red-meat": 1, pork: 0, vegetarianVegan: 0 }
   */
  proteinTargets: ProteinTargets;
};

/**
 * Weekly protein distribution targets.
 * vegetarianVegan is a single counter covering both vegetarian + vegan recipes,
 * matching the onboarding UI (they share one counter per the spec).
 */
export type ProteinTargets = {
  poultry: number;
  "fish-seafood": number;
  "red-meat": number;
  pork: number;
  vegetarianVegan: number;
};

/**
 * A single planned meal slot in the week.
 * One slot = one day's dinner.
 */
export type MealSlot = {
  /** ISO date string for the calendar day, e.g. "2026-05-19" */
  date: string;
  /** The recipe assigned to this slot, or null if empty */
  recipeId: string | null;
  /** True if the user manually pinned this slot — skipped by auto-regeneration */
  isLocked: boolean;
  /**
   * Confirmation status of whether the meal was actually cooked.
   * - "pending"   = planned but not yet confirmed (default for future/today)
   * - "cooked"    = user confirmed they made it
   * - "skipped"   = user confirmed they skipped it
   * - "untracked" = slot was never assigned a recipe
   */
  status: "pending" | "cooked" | "skipped" | "untracked";
};

/**
 * The active week's meal plan.
 * Stored in AppData so it syncs to Supabase alongside recipes.
 */
export type MealPlan = {
  /** ISO date string of the Monday that starts this plan week */
  weekStart: string;
  /** Ordered array of slots, one per planned day */
  slots: MealSlot[];
};

/**
 * A recipe's computed score during the recommendation algorithm.
 * Used internally by the scoring engine — never persisted.
 */
export type ScoredRecipe = {
  recipe: Recipe;
  score: number;
};

// ─── Kitchen Wrapped ────────────────────────────────────────────────────────

/**
 * One record of an actual cook, appended (never edited/removed) any time
 * lastCookedAt gets stamped on a recipe — from the edit-page/inline date
 * editor, a confirmed planner slot, or a telemetry-confirmed history slot.
 *
 * `recipeTitle` and `proteinType` are snapshotted at the time of the cook —
 * not looked up live — so Kitchen Wrapped keeps working (and keeps its
 * historical protein mix accurate) even if a recipe is later renamed,
 * re-categorized, or deleted entirely. `folderId` and the photo are looked
 * up live from the current recipe, since those are more "my library is
 * organized this way now" facts than historical ones.
 */
export type CookEvent = {
  id: string;
  recipeId: string;
  recipeTitle: string;
  proteinType: ProteinType;
  /** ISO timestamp — the date being credited for this cook. */
  cookedAt: string;
};

// ─── Protein Math ─────────────────────────────────────────────────────────────

/** Whether a protein source's grams-per-100g figure was measured raw or cooked. */
export type ProteinBasis = "raw" | "cooked";

/**
 * Mirrors the app's existing protein categories (poultry, red meat, pork,
 * fish & seafood, vegetarian — the same groupings used for recipes and
 * Kitchen Wrapped), minus vegan/none, since this workspace is specifically
 * about converting a protein target into grams of a specific food to buy or prep.
 */
export type ProteinSourceCategory =
  | "poultry"
  | "red-meat"
  | "pork"
  | "fish-seafood"
  | "vegetarian";

/**
 * One protein/meat reference entry — e.g. "Chicken Breast" at 23g protein
 * per 100g raw. `proteinPer100g` and `basis` are per-entry, not a single
 * app-wide assumption, since a real household reference list is often a mix
 * of raw-weight and already-cooked figures.
 */
export type ProteinSource = {
  id: string;
  name: string;
  category: ProteinSourceCategory;
  proteinPer100g: number;
  basis: ProteinBasis;
  /** Free-text caveats, e.g. "Bone-in — roughly 50% cooked yield." */
  notes: string;
};

/** One household member's inputs for their daily protein target. */
export type NutritionPerson = {
  name: string;
  weightKg: number;
  /** Grams of protein targeted per kg of body weight per day. */
  gramsPerKg: number;
};

/**
 * Settings for the Protein Math workspace. Fixed to two people (built around
 * a couple, not a general household size) and a fixed 2-meals/day
 * (lunch + dinner) 50/50 split.
 */
export type NutritionConfig = {
  people: [NutritionPerson, NutritionPerson];
  proteins: ProteinSource[];
};