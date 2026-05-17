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
    .channel(`recipe_library:${userId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: TABLE,
        filter: `user_id=eq.${userId}`,
      },
      async () => {
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
      // Existing field normalization patterns
      prepTime: recipe.prepTime ?? "",
      cookTime: recipe.cookTime ?? "",
      totalTime: recipe.totalTime ?? "",
      yields: (recipe as unknown as Record<string, string>)["servings"] ?? recipe.yields ?? "",
      
      // New field normalization to prevent uncontrolled input errors on older items
      notes: recipe.notes ?? "",
      author: recipe.author ?? "",
      recipeSite: recipe.recipeSite ?? "",
    })),
    labels: raw.labels ?? [],
    folders: (raw.folders ?? defaultAppData.folders).map((folder, index) => ({
      ...folder,
      order: typeof folder.order === "number" ? folder.order : index,
    })),
  };
}