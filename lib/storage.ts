import { defaultAppData, normalizeNutritionConfig, normalizePlannerConfig } from "./defaults";
import type { AppData } from "./types";

const STORAGE_KEY = "recipe-app-data-v1";

export function loadAppData(): AppData {
  if (typeof window === "undefined") {
    return defaultAppData;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppData;
    const parsed = { ...defaultAppData, ...JSON.parse(raw) } as AppData;
    parsed.folders = parsed.folders.map((folder, index) => ({
      ...folder,
      order: typeof folder.order === "number" ? folder.order : index,
    }));
    parsed.folders.sort((a, b) => a.order - b.order);
    parsed.plannerConfig = normalizePlannerConfig(parsed.plannerConfig);
    parsed.nutrition = normalizeNutritionConfig(parsed.nutrition);
    // Prune Kitchen Wrapped cook-log entries left over from a deleted recipe
    // (deleteRecipe now cascades going forward, but this cleans up anything
    // already orphaned in previously-saved data).
    const validRecipeIds = new Set(parsed.recipes.map((r) => r.id));
    parsed.cookLog = (parsed.cookLog ?? []).filter((event) => validRecipeIds.has(event.recipeId));
    return parsed;
  } catch {
    return defaultAppData;
  }
}

/**
 * localStorage is only an offline mirror here — Supabase (saveCloudData in
 * AppProvider) is the real source of truth and is written independently,
 * right alongside this call. localStorage.setItem CAN throw (most commonly
 * QuotaExceededError once a library with embedded recipe photos grows past
 * the browser's per-origin storage cap, typically 5-10MB) — letting that
 * escape uncaught previously took down the whole app on every subsequent
 * mutation, even though the cloud write it ran alongside kept succeeding.
 * Swallow it here: worst case the offline cache lags until something frees
 * up space, but the app keeps working and the cloud copy stays correct.
 */
export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.warn("saveAppData: localStorage write failed, offline cache not updated", err);
  }
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
