"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createId } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchMaintenanceCloudData,
  forceOverwriteMaintenanceCloudData,
  saveMaintenanceCloudData,
  subscribeToMaintenanceCloudData,
} from "@/lib/supabase/maintenanceSync";
import { isSuspiciousDataLoss } from "@/lib/syncGuard";
import { loadMaintenanceData, saveMaintenanceData } from "@/lib/maintenance/storage";
import { recalculateLastDone } from "@/lib/maintenance/status";
import type {
  MaintenanceData,
  MaintenanceItem,
  MaintenanceItemDraft,
} from "@/lib/maintenance/types";

type SyncStatus = "local" | "syncing" | "synced" | "offline" | "conflict";

/** Mirrors PendingConflict in context/AppProvider.tsx — same rationale, same rule. */
export type MaintenancePendingConflict = {
  localData: MaintenanceData;
  remoteData: MaintenanceData;
  remoteVersion: number;
  localCount: number;
  remoteCount: number;
};

const EMPTY_DATA: MaintenanceData = { items: [] };

type MaintenanceContextValue = {
  ready: boolean;
  items: MaintenanceItem[];
  user: User | null;
  syncStatus: SyncStatus;
  cloudEnabled: boolean;
  conflict: MaintenancePendingConflict | null;
  resolveConflict: (choice: "keep-local" | "use-remote") => Promise<void>;

  addItem: (draft: MaintenanceItemDraft) => MaintenanceItem;
  updateItem: (id: string, draft: MaintenanceItemDraft) => void;
  deleteItem: (id: string) => void;
  /** Applies a new manual drag-reorder position to every item, in the given order. */
  reorderItems: (orderedIds: string[]) => void;

  /** Appends a new history entry (mark-done) and recomputes lastDoneDate. */
  logDone: (itemId: string, date: string, note?: string) => void;
  /** Edits an existing history entry's date/note, then recomputes lastDoneDate. */
  updateHistoryEntry: (itemId: string, entryId: string, date: string, note?: string) => void;
  /** Removes a history entry, then recomputes lastDoneDate from what remains. */
  deleteHistoryEntry: (itemId: string, entryId: string) => void;
};

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

export function MaintenanceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MaintenanceData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [conflict, setConflict] = useState<MaintenancePendingConflict | null>(null);
  const cloudEnabled = isSupabaseConfigured();

  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const dataRef = useRef<MaintenanceData>(data);
  dataRef.current = data;
  const unsubscribeRealtimeRef = useRef<(() => void) | undefined>(undefined);
  const cloudVersionRef = useRef<number | null>(null);

  const persistAndSync = useCallback(
    (updater: (prev: MaintenanceData) => MaintenanceData) => {
      setData((prev) => {
        const next = updater(prev);
        saveMaintenanceData(next);

        const currentUser = userRef.current;
        if (currentUser && cloudEnabled) {
          setSyncStatus("syncing");
          const expectedVersion = cloudVersionRef.current;

          saveMaintenanceCloudData(currentUser.id, next, expectedVersion)
            .then(async (result) => {
              if (result.status === "ok") {
                cloudVersionRef.current = result.version;
                setSyncStatus("synced");
                return;
              }
              // Conflict: pull the real current state rather than fight over it —
              // unless that would mean silently losing real data (see
              // lib/syncGuard.ts), in which case pause for a human decision.
              const fresh = await fetchMaintenanceCloudData(currentUser.id);
              if (fresh.status === "found") {
                const localCount = next.items.length;
                const remoteCount = fresh.data.items.length;
                if (isSuspiciousDataLoss(localCount, remoteCount)) {
                  setConflict({
                    localData: next,
                    remoteData: fresh.data,
                    remoteVersion: fresh.version,
                    localCount,
                    remoteCount,
                  });
                  setSyncStatus("conflict");
                  return;
                }
                cloudVersionRef.current = fresh.version;
                setData(fresh.data);
                saveMaintenanceData(fresh.data);
              }
              setSyncStatus("conflict");
            })
            .catch(() => setSyncStatus("offline"));
        }

        return next;
      });
    },
    [cloudEnabled],
  );

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      setData(loadMaintenanceData());
      setSyncStatus("local");
      setReady(true);
      return;
    }

    let initialLoadDone = false;

    async function loadForUser(currentUser: User | null) {
      unsubscribeRealtimeRef.current?.();
      unsubscribeRealtimeRef.current = undefined;

      if (!currentUser) {
        cloudVersionRef.current = null;
        setData(loadMaintenanceData());
        setSyncStatus("local");
        setReady(true);
        return;
      }

      setSyncStatus("syncing");
      const result = await fetchMaintenanceCloudData(currentUser.id);

      if (result.status === "found") {
        // A fresh page load (e.g. opening the app on a different device) is
        // exactly the path that silently adopted a wiped/smaller cloud copy
        // before this fix — it never compared against what THIS device
        // already had cached locally before overwriting it.
        const local = loadMaintenanceData();
        const localCount = local.items.length;
        const remoteCount = result.data.items.length;
        if (isSuspiciousDataLoss(localCount, remoteCount)) {
          setData(local);
          setConflict({
            localData: local,
            remoteData: result.data,
            remoteVersion: result.version,
            localCount,
            remoteCount,
          });
          setSyncStatus("conflict");
        } else {
          setData(result.data);
          saveMaintenanceData(result.data);
          cloudVersionRef.current = result.version;
          setSyncStatus("synced");
        }
      } else if (result.status === "not-found") {
        const local = loadMaintenanceData();
        const seed = local.items.length > 0 ? local : EMPTY_DATA;
        setData(seed);
        try {
          const saveResult = await saveMaintenanceCloudData(currentUser.id, seed, null);
          if (saveResult.status === "ok") {
            cloudVersionRef.current = saveResult.version;
            setSyncStatus("synced");
          } else {
            // Two devices raced to create the account's first row — the
            // exact race that once wiped a real recipe library. Don't take
            // whichever side won blindly.
            const refetch = await fetchMaintenanceCloudData(currentUser.id);
            if (refetch.status === "found") {
              const localCount = seed.items.length;
              const remoteCount = refetch.data.items.length;
              if (isSuspiciousDataLoss(localCount, remoteCount)) {
                setConflict({
                  localData: seed,
                  remoteData: refetch.data,
                  remoteVersion: refetch.version,
                  localCount,
                  remoteCount,
                });
                setSyncStatus("conflict");
              } else {
                setData(refetch.data);
                saveMaintenanceData(refetch.data);
                cloudVersionRef.current = refetch.version;
                setSyncStatus("synced");
              }
            } else {
              setSyncStatus("offline");
            }
          }
        } catch {
          setSyncStatus("offline");
        }
      } else {
        // Ambiguous/network/query error — never overwrite; use the local cache.
        cloudVersionRef.current = null;
        setData(loadMaintenanceData());
        setSyncStatus("offline");
      }

      unsubscribeRealtimeRef.current = subscribeToMaintenanceCloudData(currentUser.id, (fresh, version) => {
        if (cloudVersionRef.current !== null && version <= cloudVersionRef.current) return;
        const localCount = dataRef.current.items.length;
        const remoteCount = fresh.items.length;
        if (isSuspiciousDataLoss(localCount, remoteCount)) {
          setConflict({
            localData: dataRef.current,
            remoteData: fresh,
            remoteVersion: version,
            localCount,
            remoteCount,
          });
          setSyncStatus("conflict");
          return;
        }
        cloudVersionRef.current = version;
        setData(fresh);
        saveMaintenanceData(fresh);
        setSyncStatus("synced");
      });

      setReady(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      userRef.current = currentUser;
      initialLoadDone = true;
      loadForUser(currentUser);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!initialLoadDone) return;
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      userRef.current = currentUser;

      if (!currentUser) {
        unsubscribeRealtimeRef.current?.();
        unsubscribeRealtimeRef.current = undefined;
        cloudVersionRef.current = null;
        setSyncStatus("local");
      } else {
        loadForUser(currentUser);
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRealtimeRef.current?.();
    };
  }, []);

  const resolveConflict = useCallback(
    async (choice: "keep-local" | "use-remote") => {
      if (!conflict) return;

      if (choice === "use-remote") {
        cloudVersionRef.current = conflict.remoteVersion;
        setData(conflict.remoteData);
        saveMaintenanceData(conflict.remoteData);
        setSyncStatus("synced");
        setConflict(null);
        return;
      }

      const currentUser = userRef.current;
      if (!currentUser || !cloudEnabled) {
        setData(conflict.localData);
        saveMaintenanceData(conflict.localData);
        setConflict(null);
        setSyncStatus("local");
        return;
      }

      setSyncStatus("syncing");
      try {
        const result = await forceOverwriteMaintenanceCloudData(currentUser.id, conflict.localData);
        if (result.status === "ok") {
          cloudVersionRef.current = result.version;
          setData(conflict.localData);
          saveMaintenanceData(conflict.localData);
          setSyncStatus("synced");
          setConflict(null);
        } else {
          setSyncStatus("offline");
        }
      } catch {
        setSyncStatus("offline");
      }
    },
    [conflict, cloudEnabled],
  );

  const addItem = useCallback(
    (draft: MaintenanceItemDraft) => {
      const history = draft.lastDoneDate
        ? [{ id: createId(), date: draft.lastDoneDate }]
        : [];
      let created!: MaintenanceItem;
      persistAndSync((prev) => {
        const maxOrder = prev.items.reduce((max, it) => Math.max(max, it.order ?? 0), -1);
        created = {
          id: createId(),
          name: draft.name.trim(),
          category: draft.category?.trim() || undefined,
          intervalDays: draft.intervalDays,
          lastDoneDate: recalculateLastDone(history),
          history,
          notes: draft.notes?.trim() || undefined,
          order: maxOrder + 1,
        };
        return { items: [created, ...prev.items] };
      });
      return created;
    },
    [persistAndSync],
  );

  const updateItem = useCallback(
    (id: string, draft: MaintenanceItemDraft) => {
      persistAndSync((prev) => ({
        items: prev.items.map((it) =>
          it.id === id
            ? {
                ...it,
                name: draft.name.trim(),
                category: draft.category?.trim() || undefined,
                intervalDays: draft.intervalDays,
                notes: draft.notes?.trim() || undefined,
              }
            : it,
        ),
      }));
    },
    [persistAndSync],
  );

  const reorderItems = useCallback(
    (orderedIds: string[]) => {
      persistAndSync((prev) => {
        const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
        return {
          items: prev.items.map((it) =>
            orderMap.has(it.id) ? { ...it, order: orderMap.get(it.id)! } : it,
          ),
        };
      });
    },
    [persistAndSync],
  );

  const deleteItem = useCallback(
    (id: string) => {
      persistAndSync((prev) => ({ items: prev.items.filter((it) => it.id !== id) }));
    },
    [persistAndSync],
  );

  const logDone = useCallback(
    (itemId: string, date: string, note?: string) => {
      persistAndSync((prev) => ({
        items: prev.items.map((it) => {
          if (it.id !== itemId) return it;
          const history = [...it.history, { id: createId(), date, note: note?.trim() || undefined }];
          return { ...it, history, lastDoneDate: recalculateLastDone(history) };
        }),
      }));
    },
    [persistAndSync],
  );

  const updateHistoryEntry = useCallback(
    (itemId: string, entryId: string, date: string, note?: string) => {
      persistAndSync((prev) => ({
        items: prev.items.map((it) => {
          if (it.id !== itemId) return it;
          const history = it.history.map((h) =>
            h.id === entryId ? { ...h, date, note: note?.trim() || undefined } : h,
          );
          return { ...it, history, lastDoneDate: recalculateLastDone(history) };
        }),
      }));
    },
    [persistAndSync],
  );

  const deleteHistoryEntry = useCallback(
    (itemId: string, entryId: string) => {
      persistAndSync((prev) => ({
        items: prev.items.map((it) => {
          if (it.id !== itemId) return it;
          const history = it.history.filter((h) => h.id !== entryId);
          return { ...it, history, lastDoneDate: recalculateLastDone(history) };
        }),
      }));
    },
    [persistAndSync],
  );

  return (
    <MaintenanceContext.Provider
      value={{
        ready,
        items: data.items,
        user,
        syncStatus,
        cloudEnabled,
        conflict,
        resolveConflict,
        addItem,
        updateItem,
        deleteItem,
        reorderItems,
        logDone,
        updateHistoryEntry,
        deleteHistoryEntry,
      }}
    >
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance(): MaintenanceContextValue {
  const ctx = useContext(MaintenanceContext);
  if (!ctx) throw new Error("useMaintenance must be used within a MaintenanceProvider");
  return ctx;
}
