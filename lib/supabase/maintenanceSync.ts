import type { MaintenanceData } from "@/lib/maintenance/types";
import { getSupabase } from "./client";

const TABLE = "maintenance_library";

const EMPTY_DATA: MaintenanceData = { items: [] };

function normalizeMaintenanceData(raw: Partial<MaintenanceData> | null | undefined): MaintenanceData {
  const items = raw?.items ?? [];
  return {
    items: items.map((item, index) => ({
      ...item,
      order: typeof item.order === "number" ? item.order : index,
    })),
  };
}

/**
 * Tri-state fetch result — same fix as recipe_library's sync.ts: an
 * ambiguous fetch (network hiccup, RLS error, transient Supabase error)
 * must never be treated the same as "no row exists yet", or a real
 * account's data can get silently overwritten with empty defaults.
 */
export type MaintenanceCloudFetchResult =
  | { status: "found"; data: MaintenanceData; version: number }
  | { status: "not-found" }
  | { status: "error"; error: unknown };

export async function fetchMaintenanceCloudData(userId: string): Promise<MaintenanceCloudFetchResult> {
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
    data: normalizeMaintenanceData(data.data as MaintenanceData),
    version: typeof data.version === "number" ? data.version : 1,
  };
}

export type MaintenanceCloudSaveResult =
  | { status: "ok"; version: number }
  | { status: "conflict" };

/**
 * Version-guarded write — identical concurrency pattern to saveCloudData in
 * lib/supabase/sync.ts. expectedVersion === null means "first write ever for
 * this account" (plain insert, fails loudly on a duplicate row instead of
 * clobbering it); a number means "update guarded by that exact version".
 */
export async function saveMaintenanceCloudData(
  userId: string,
  data: MaintenanceData,
  expectedVersion: number | null,
): Promise<MaintenanceCloudSaveResult> {
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

export type MaintenanceForceOverwriteResult =
  | { status: "ok"; version: number }
  | { status: "error"; error: unknown };

/**
 * Deliberately bypasses the optimistic-concurrency guard — mirrors
 * forceOverwriteCloudData in lib/supabase/sync.ts. Only ever called after a
 * human has explicitly chosen "keep my device's data" on the
 * conflict-resolution banner.
 */
export async function forceOverwriteMaintenanceCloudData(
  userId: string,
  data: MaintenanceData,
): Promise<MaintenanceForceOverwriteResult> {
  const supabase = getSupabase();
  if (!supabase) return { status: "ok", version: 1 };

  const current = await fetchMaintenanceCloudData(userId);

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

export function subscribeToMaintenanceCloudData(
  userId: string,
  onUpdate: (data: MaintenanceData, version: number) => void,
): () => void {
  const supabase = getSupabase();
  if (!supabase) return () => {};

  // React dev-mode (Strict Mode) runs effects twice on mount, which can call
  // this twice in quick succession before the first channel's cleanup runs.
  // supabase-js caches channels by topic name and refuses to re-attach
  // .on() listeners to one that's already subscribed — remove any stale
  // channel with this exact name first so a re-subscribe never collides.
  const topic = `realtime:maintenance_library_${userId}`;
  const existing = supabase.getChannels().find((ch) => ch.topic === topic);
  if (existing) supabase.removeChannel(existing);

  const channel = supabase
    .channel(`maintenance_library_${userId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE },
      async (payload) => {
        const row = payload.new as { user_id?: string } | undefined;
        if (row?.user_id && row.user_id !== userId) return;

        const fresh = await fetchMaintenanceCloudData(userId);
        if (fresh.status === "found") onUpdate(fresh.data, fresh.version);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export { EMPTY_DATA as emptyMaintenanceData };
