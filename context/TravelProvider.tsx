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
  fetchTravelCloudData,
  forceOverwriteTravelCloudData,
  saveTravelCloudData,
  subscribeToTravelCloudData,
} from "@/lib/supabase/travelSync";
import { isSuspiciousDataLoss } from "@/lib/syncGuard";
import { loadTravelData, saveTravelData } from "@/lib/travel/storage";
import type { TravelData, Trip, TripDraft } from "@/lib/travel/types";

type SyncStatus = "local" | "syncing" | "synced" | "offline" | "conflict";

/** Mirrors PendingConflict in context/AppProvider.tsx — same rationale, same rule. */
export type TravelPendingConflict = {
  localData: TravelData;
  remoteData: TravelData;
  remoteVersion: number;
  localCount: number;
  remoteCount: number;
};

const EMPTY_DATA: TravelData = { trips: [] };

type TravelContextValue = {
  ready: boolean;
  trips: Trip[];
  user: User | null;
  syncStatus: SyncStatus;
  cloudEnabled: boolean;
  conflict: TravelPendingConflict | null;
  resolveConflict: (choice: "keep-local" | "use-remote") => Promise<void>;

  addTrip: (draft: TripDraft) => Trip;
  updateTrip: (id: string, draft: TripDraft) => void;
  deleteTrip: (id: string) => void;
  /** Sets arrivalDate (and optionally arrivalLocation) on an in-progress trip — the "I'm back" action. */
  completeTrip: (id: string, arrivalDate: string, arrivalLocation?: string) => void;
};

const TravelContext = createContext<TravelContextValue | null>(null);

export function TravelProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<TravelData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const [conflict, setConflict] = useState<TravelPendingConflict | null>(null);
  const cloudEnabled = isSupabaseConfigured();

  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const dataRef = useRef<TravelData>(data);
  dataRef.current = data;
  const unsubscribeRealtimeRef = useRef<(() => void) | undefined>(undefined);
  const cloudVersionRef = useRef<number | null>(null);
  // Chains cloud writes so they run strictly one at a time — same fix as
  // AppProvider's/MaintenanceProvider's cloudSaveQueueRef. Without it, two
  // edits fired close together both read cloudVersionRef before either
  // write confirms; the second collides with the first as a false
  // "conflict" and gets its change silently reverted to a stale fetched copy.
  const cloudSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const syncToCloud = useCallback(
    async (next: TravelData) => {
      const currentUser = userRef.current;
      if (!currentUser || !cloudEnabled) return;

      setSyncStatus("syncing");
      const expectedVersion = cloudVersionRef.current;

      try {
        const result = await saveTravelCloudData(currentUser.id, next, expectedVersion);
        if (result.status === "ok") {
          cloudVersionRef.current = result.version;
          setSyncStatus("synced");
          return;
        }
        // Conflict: pull the real current state rather than fight over it —
        // unless that would mean silently losing real data (see
        // lib/syncGuard.ts), in which case pause for a human decision.
        const fresh = await fetchTravelCloudData(currentUser.id);
        if (fresh.status === "found") {
          const localCount = next.trips.length;
          const remoteCount = fresh.data.trips.length;
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
          saveTravelData(fresh.data);
        }
        setSyncStatus("conflict");
      } catch {
        setSyncStatus("offline");
      }
    },
    [cloudEnabled],
  );

  const persistAndSync = useCallback(
    (updater: (prev: TravelData) => TravelData) => {
      setData((prev) => {
        const next = updater(prev);
        saveTravelData(next);
        cloudSaveQueueRef.current = cloudSaveQueueRef.current.then(() =>
          syncToCloud(next),
        );
        return next;
      });
    },
    [syncToCloud],
  );

  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      setData(loadTravelData());
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
        setData(loadTravelData());
        setSyncStatus("local");
        setReady(true);
        return;
      }

      setSyncStatus("syncing");
      const result = await fetchTravelCloudData(currentUser.id);

      if (result.status === "found") {
        // A fresh page load (e.g. opening the app on a different device) is
        // exactly the path that silently adopted a wiped/smaller cloud copy
        // before this fix — it never compared against what THIS device
        // already had cached locally before overwriting it.
        const local = loadTravelData();
        const localCount = local.trips.length;
        const remoteCount = result.data.trips.length;
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
          saveTravelData(result.data);
          cloudVersionRef.current = result.version;
          setSyncStatus("synced");
        }
      } else if (result.status === "not-found") {
        const local = loadTravelData();
        const seed = local.trips.length > 0 ? local : EMPTY_DATA;
        setData(seed);
        try {
          const saveResult = await saveTravelCloudData(currentUser.id, seed, null);
          if (saveResult.status === "ok") {
            cloudVersionRef.current = saveResult.version;
            setSyncStatus("synced");
          } else {
            // Two devices raced to create the account's first row — the
            // exact race that once wiped a real recipe library. Don't take
            // whichever side won blindly.
            const refetch = await fetchTravelCloudData(currentUser.id);
            if (refetch.status === "found") {
              const localCount = seed.trips.length;
              const remoteCount = refetch.data.trips.length;
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
                saveTravelData(refetch.data);
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
        setData(loadTravelData());
        setSyncStatus("offline");
      }

      unsubscribeRealtimeRef.current = subscribeToTravelCloudData(currentUser.id, (fresh, version) => {
        if (cloudVersionRef.current !== null && version <= cloudVersionRef.current) return;
        const localCount = dataRef.current.trips.length;
        const remoteCount = fresh.trips.length;
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
        saveTravelData(fresh);
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
        saveTravelData(conflict.remoteData);
        setSyncStatus("synced");
        setConflict(null);
        return;
      }

      const currentUser = userRef.current;
      if (!currentUser || !cloudEnabled) {
        setData(conflict.localData);
        saveTravelData(conflict.localData);
        setConflict(null);
        setSyncStatus("local");
        return;
      }

      setSyncStatus("syncing");
      try {
        const result = await forceOverwriteTravelCloudData(currentUser.id, conflict.localData);
        if (result.status === "ok") {
          cloudVersionRef.current = result.version;
          setData(conflict.localData);
          saveTravelData(conflict.localData);
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

  const addTrip = useCallback(
    (draft: TripDraft) => {
      let created!: Trip;
      persistAndSync((prev) => {
        created = {
          id: createId(),
          type: draft.type,
          departureDate: draft.departureDate,
          arrivalDate: draft.arrivalDate,
          departureLocation: draft.departureLocation.trim(),
          arrivalLocation: draft.arrivalLocation.trim(),
          mode: draft.mode,
          countries: draft.countries,
          notes: draft.notes?.trim() || undefined,
        };
        return { trips: [created, ...prev.trips] };
      });
      return created;
    },
    [persistAndSync],
  );

  const updateTrip = useCallback(
    (id: string, draft: TripDraft) => {
      persistAndSync((prev) => ({
        trips: prev.trips.map((t) =>
          t.id === id
            ? {
                ...t,
                type: draft.type,
                departureDate: draft.departureDate,
                arrivalDate: draft.arrivalDate,
                departureLocation: draft.departureLocation.trim(),
                arrivalLocation: draft.arrivalLocation.trim(),
                mode: draft.mode,
                countries: draft.countries,
                notes: draft.notes?.trim() || undefined,
              }
            : t,
        ),
      }));
    },
    [persistAndSync],
  );

  const deleteTrip = useCallback(
    (id: string) => {
      persistAndSync((prev) => ({ trips: prev.trips.filter((t) => t.id !== id) }));
    },
    [persistAndSync],
  );

  const completeTrip = useCallback(
    (id: string, arrivalDate: string, arrivalLocation?: string) => {
      persistAndSync((prev) => ({
        trips: prev.trips.map((t) =>
          t.id === id
            ? {
                ...t,
                arrivalDate,
                arrivalLocation: arrivalLocation?.trim() || t.arrivalLocation,
              }
            : t,
        ),
      }));
    },
    [persistAndSync],
  );

  return (
    <TravelContext.Provider
      value={{
        ready,
        trips: data.trips,
        user,
        syncStatus,
        cloudEnabled,
        conflict,
        resolveConflict,
        addTrip,
        updateTrip,
        deleteTrip,
        completeTrip,
      }}
    >
      {children}
    </TravelContext.Provider>
  );
}

export function useTravel(): TravelContextValue {
  const ctx = useContext(TravelContext);
  if (!ctx) throw new Error("useTravel must be used within a TravelProvider");
  return ctx;
}
