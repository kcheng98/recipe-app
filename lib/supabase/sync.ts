import { defaultAppData } from "@/lib/defaults";
import type { AppData } from "@/lib/types";
import { getSupabase } from "./client";

const TABLE = "recipe_library";

export async function fetchCloudData(userId: string): Promise<AppData | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .select("data")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.data) return null;
  return normalizeAppData(data.data as AppData);
}

export async function saveCloudData(
  userId: string,
  appData: AppData,
): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  const { error } = await supabase.from(TABLE).upsert({
    user_id: userId,
    data: appData,
    updated_at: new Date().toISOString(),
  });

  if (error) throw error;
}

export function subscribeToCloudData(
  userId: string,
  onUpdate: (data: AppData) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

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
        if (fresh) onUpdate(fresh);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

function normalizeAppData(raw: AppData): AppData {
  return {
    recipes: (raw.recipes ?? defaultAppData.recipes).map((recipe) => ({
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
      supportedStores: recipe.supportedStores ?? ["Standard"],
    })),
    labels: raw.labels ?? [],
    folders: (raw.folders ?? defaultAppData.folders).map((folder, index) => ({
      ...folder,
      order: typeof folder.order === "number" ? folder.order : index,
    })),
    // ── Planner fields ──
    plannerConfig: raw.plannerConfig ?? null,
    mealPlan: raw.mealPlan ?? null,
  };
}