import { defaultAppData, normalizeNutritionConfig, normalizePlannerConfig } from "@/lib/defaults";
import type { AppData } from "@/lib/types";
import { getSupabase } from "./client";

const TABLE = "recipe_library";

/**
 * Tri-state fetch result — this is the fix for the incident where an
 * ambiguous fetch (network hiccup, RLS error, transient Supabase error) was
 * being treated the same as "no row exists yet," which caused a real
 * account's data to be silently overwritten with empty defaults.
 *
 * - "found": the row exists, here's the data and its current version.
 * - "not-found": Supabase positively confirmed no row exists for this user
 *   (maybeSingle() returned no row AND no error). Only this state may ever
 *   trigger seeding + pushing defaults.
 * - "error": something went wrong and we don't actually know whether a row
 *   exists. Callers must NEVER treat this as "safe to seed."
 */
export type CloudFetchResult =
  | { status: "found"; data: AppData; version: number }
  | { status: "not-found" }
  | { status: "error"; error: unknown };

export async function fetchCloudData(userId: string): Promise<CloudFetchResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return { status: "error", error: new Error("Supabase not configured") };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select("data, version")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { status: "error", error };
  if (!data) return { status: "not-found" };

  return {
    status: "found",
    data: normalizeAppData(data.data as AppData),
    version: typeof data.version === "number" ? data.version : 1,
  };
}

export type CloudSaveResult =
  | { status: "ok"; version: number }
  | { status: "conflict" };

/**
 * Writes appData to the cloud with optimistic concurrency control.
 *
 * - expectedVersion === null: this is the FIRST write ever for this
 *   account (only ever called after fetchCloudData confirmed "not-found").
 *   Uses a plain insert, which fails loudly on a unique-key violation if a
 *   row already exists — it can never silently clobber one.
 * - expectedVersion is a number: this is an update, guarded by
 *   `where version = expectedVersion`. If another device (or tab) saved in
 *   between, the row's version has already moved on, zero rows match, and
 *   this returns {status:"conflict"} instead of overwriting that device's
 *   write with our stale copy.
 */
export async function saveCloudData(
  userId: string,
  appData: AppData,
  expectedVersion: number | null,
): Promise<CloudSaveResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "ok", version: expectedVersion ?? 1 };

  if (expectedVersion === null) {
    const { error } = await supabase.from(TABLE).insert({
      user_id: userId,
      data: appData,
      version: 1,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      // 23505 = unique_violation — a row already exists for this user.
      // Someone/something beat us to it; treat as a conflict, never retry blind.
      if ((error as { code?: string }).code === "23505") {
        return { status: "conflict" };
      }
      throw error;
    }
    return { status: "ok", version: 1 };
  }

  const nextVersion = expectedVersion + 1;
  const { data: rows, error } = await supabase
    .from(TABLE)
    .update({
      data: appData,
      version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("version", expectedVersion)
    .select("version");

  if (error) throw error;
  if (!rows || rows.length === 0) return { status: "conflict" };
  return { status: "ok", version: nextVersion };
}

export type ForceOverwriteResult =
  | { status: "ok"; version: number }
  | { status: "error"; error: unknown };

/**
 * Deliberately bypasses the optimistic-concurrency guard. Every other write
 * in this file refuses to clobber a newer save it didn't know about — that
 * protection is exactly right for background/automatic saves. This
 * function exists for the one case where a HUMAN has explicitly reviewed
 * both copies and said "no, overwrite the cloud with my device's data
 * anyway" (the "Keep local" side of the conflict-resolution banner). It
 * still bumps the version counter forward so subsequent normal saves stay
 * correctly guarded.
 */
export async function forceOverwriteCloudData(
  userId: string,
  appData: AppData,
): Promise<ForceOverwriteResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "ok", version: 1 };

  const current = await fetchCloudData(userId);

  if (current.status === "not-found") {
    const { error } = await supabase.from(TABLE).insert({
      user_id: userId,
      data: appData,
      version: 1,
      updated_at: new Date().toISOString(),
    });
    if (error) return { status: "error", error };
    return { status: "ok", version: 1 };
  }

  const nextVersion = current.status === "found" ? current.version + 1 : 1;
  const { error } = await supabase
    .from(TABLE)
    .update({ data: appData, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) return { status: "error", error };
  return { status: "ok", version: nextVersion };
}

export function subscribeToCloudData(
  userId: string,
  onUpdate: (data: AppData, version: number) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  // React dev-mode (Strict Mode) runs effects twice on mount, which can call
  // this twice in quick succession before the first channel's cleanup runs.
  // supabase-js caches channels by topic name and refuses to re-attach
  // .on() listeners to one that's already subscribed — remove any stale
  // channel with this exact name first so a re-subscribe never collides.
  const topic = `realtime:recipe_library_${userId}`;
  const existing = supabase.getChannels().find((ch) => ch.topic === topic);
  if (existing) supabase.removeChannel(existing);

  const channel = supabase
    .channel(`recipe_library_${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE,
        // Remove the filter — receive all changes, then check userId in handler
      },
      async (payload) => {
        // Only process rows that belong to this user
        const row = payload.new as { user_id?: string } | undefined;
        if (row?.user_id && row.user_id !== userId) return;

        const fresh = await fetchCloudData(userId);
        if (fresh.status === "found") onUpdate(fresh.data, fresh.version);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function normalizeAppData(raw: AppData): AppData {
  const recipes = (raw.recipes ?? defaultAppData.recipes).map((recipe) => ({
    ...recipe,
    prepTime: recipe.prepTime ?? "",
    cookTime: recipe.cookTime ?? "",
    totalTime: recipe.totalTime ?? "",
    yields: (recipe as unknown as Record<string, string>)["servings"] ?? recipe.yields ?? "",
    notes: recipe.notes ?? "",
    author: recipe.author ?? "",
    recipeSite: recipe.recipeSite ?? "",
    // ── Pillar defaults for existing recipes ──
    proteinType: recipe.proteinType ?? "none",
    lastCookedAt: recipe.lastCookedAt ?? null,
    vibe: recipe.vibe ?? "all-weather",
  }));

  // Kitchen Wrapped's cook log now cascades with recipe deletion (deleteRecipe
  // in AppProvider filters it directly), but that only covers deletions from
  // here forward. This prunes any entries that already point at a recipe id
  // that no longer exists — leftover ghosts from before that fix, or from a
  // recipe deleted on another device — every time data is normalized.
  const validRecipeIds = new Set(recipes.map((r) => r.id));
  const cookLog = (raw.cookLog ?? defaultAppData.cookLog).filter((event) =>
    validRecipeIds.has(event.recipeId),
  );

  return {
    recipes,
    labels: raw.labels ?? [],
    folders: (raw.folders ?? defaultAppData.folders).map((folder, index) => ({
      ...folder,
      order: typeof folder.order === "number" ? folder.order : index,
    })),
    // ── Planner fields ──
    plannerConfig: normalizePlannerConfig(raw.plannerConfig),
    mealPlan: raw.mealPlan ?? null,
    // ── Kitchen Wrapped ──
    cookLog,
    // ── Protein Math ── (missing entirely for data saved before this shipped)
    nutrition: normalizeNutritionConfig(raw.nutrition),
  };
}
