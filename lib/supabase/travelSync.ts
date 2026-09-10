import type { TravelData } from "@/lib/travel/types";
import { getSupabase } from "./client";

const TABLE = "travel_library";

const EMPTY_DATA: TravelData = { trips: [] };

function normalizeTravelData(raw: Partial<TravelData> | null | undefined): TravelData {
  return { trips: raw?.trips ?? [] };
}

/**
 * Tri-state fetch result — same fix as recipe_library's sync.ts and
 * maintenance_library's maintenanceSync.ts: an ambiguous fetch (network
 * hiccup, RLS error, transient Supabase error) must never be treated the
 * same as "no row exists yet", or a real account's data can get silently
 * overwritten with empty defaults.
 */
export type TravelCloudFetchResult =
  | { status: "found"; data: TravelData; version: number }
  | { status: "not-found" }
  | { status: "error"; error: unknown };

export async function fetchTravelCloudData(userId: string): Promise<TravelCloudFetchResult> {
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
    data: normalizeTravelData(data.data as TravelData),
    version: typeof data.version === "number" ? data.version : 1,
  };
}

export type TravelCloudSaveResult =
  | { status: "ok"; version: number }
  | { status: "conflict" };

/**
 * Version-guarded write — identical concurrency pattern to saveCloudData in
 * lib/supabase/sync.ts. expectedVersion === null means "first write ever for
 * this account" (plain insert, fails loudly on a duplicate row instead of
 * clobbering it); a number means "update guarded by that exact version".
 */
export async function saveTravelCloudData(
  userId: string,
  data: TravelData,
  expectedVersion: number | null,
): Promise<TravelCloudSaveResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "ok", version: expectedVersion ?? 1 };

  if (expectedVersion === null) {
    const { error } = await supabase.from(TABLE).insert({
      user_id: userId,
      data,
      version: 1,
      updated_at: new Date().toISOString(),
    });

    if (error) {
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
    .update({ data, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("version", expectedVersion)
    .select("version");

  if (error) throw error;
  if (!rows || rows.length === 0) return { status: "conflict" };
  return { status: "ok", version: nextVersion };
}

export type TravelForceOverwriteResult =
  | { status: "ok"; version: number }
  | { status: "error"; error: unknown };

/**
 * Deliberately bypasses the optimistic-concurrency guard — mirrors
 * forceOverwriteCloudData in lib/supabase/sync.ts. Only ever called after a
 * human has explicitly chosen "keep my device's data" on the
 * conflict-resolution banner.
 */
export async function forceOverwriteTravelCloudData(
  userId: string,
  data: TravelData,
): Promise<TravelForceOverwriteResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "ok", version: 1 };

  const current = await fetchTravelCloudData(userId);

  if (current.status === "not-found") {
    const { error } = await supabase.from(TABLE).insert({
      user_id: userId,
      data,
      version: 1,
      updated_at: new Date().toISOString(),
    });
    if (error) return { status: "error", error };
    return { status: "ok", version: 1 };
  }

  const nextVersion = current.status === "found" ? current.version + 1 : 1;
  const { error } = await supabase
    .from(TABLE)
    .update({ data, version: nextVersion, updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (error) return { status: "error", error };
  return { status: "ok", version: nextVersion };
}

export function subscribeToTravelCloudData(
  userId: string,
  onUpdate: (data: TravelData, version: number) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  // React dev-mode (Strict Mode) runs effects twice on mount, which can call
  // this twice in quick succession before the first channel's cleanup runs.
  // supabase-js caches channels by topic name and refuses to re-attach
  // .on() listeners to one that's already subscribed — remove any stale
  // channel with this exact name first so a re-subscribe never collides.
  const topic = `realtime:travel_library_${userId}`;
  const existing = supabase.getChannels().find((ch) => ch.topic === topic);
  if (existing) supabase.removeChannel(existing);

  const channel = supabase
    .channel(`travel_library_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE },
      async (payload) => {
        const row = payload.new as { user_id?: string } | undefined;
        if (row?.user_id && row.user_id !== userId) return;

        const fresh = await fetchTravelCloudData(userId);
        if (fresh.status === "found") onUpdate(fresh.data, fresh.version);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export { EMPTY_DATA as emptyTravelData };
