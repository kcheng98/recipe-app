"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { defaultAppData } from "@/lib/defaults";
import { createId, loadAppData, saveAppData } from "@/lib/storage";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  fetchCloudData,
  saveCloudData,
  subscribeToCloudData,
} from "@/lib/supabase/sync";
import type {
  AppData,
  CookEvent,
  Folder,
  Label,
  MealPlan,
  MealSlot,
  PlannerConfig,
  Recipe,
  RecipeDraft,
} from "@/lib/types";
import { createCookEvent, createRecipe, updateRecipe } from "@/lib/recipeUtils";
import { generatePlan, scoreRecipe, weightedSample } from "@/lib/planner/algorithm";
import type { User } from "@supabase/supabase-js";

type SyncStatus = "local" | "syncing" | "synced" | "offline" | "conflict";

type AppContextValue = {
  // ── Core state ────────────────────────────────────────────────────────────
  ready: boolean;
  recipes: Recipe[];
  labels: Label[];
  folders: Folder[];
  user: User | null;
  syncStatus: SyncStatus;
  cloudEnabled: boolean;

  // ── Planner state ─────────────────────────────────────────────────────────
  plannerConfig: PlannerConfig | null;
  mealPlan: MealPlan | null;
  /** Every cook ever logged, oldest first. Powers Kitchen Wrapped. */
  cookLog: CookEvent[];
  /**
   * Slots from past weeks whose status is still "pending" — the user hasn't
   * confirmed or skipped them yet. The CookConfirmIntercept component drains
   * this queue one at a time (FIFO) on app load.
   */
  pendingConfirmations: MealSlot[];

  // ── Recipe mutations ──────────────────────────────────────────────────────
  addRecipe: (draft: RecipeDraft) => Recipe;
  updateRecipeById: (id: string, draft: RecipeDraft) => void;
  deleteRecipe: (id: string) => void;

  // ── Label mutations ───────────────────────────────────────────────────────
  addLabel: (name: string) => Label;
  updateLabel: (id: string, name: string) => void;
  deleteLabel: (id: string) => void;

  // ── Folder mutations ──────────────────────────────────────────────────────
  addFolder: (label: string, icon: string) => Folder;
  updateFolder: (id: string, label: string, icon: string) => void;
  deleteFolder: (id: string) => void;
  reorderFolders: (orderedIds: string[]) => void;

  // ── Planner actions ───────────────────────────────────────────────────────
  /** Save (or update) the user's planner preferences. */
  setPlannerConfig: (config: PlannerConfig) => void;
  /**
   * Run the 3-stage algorithm and write a fresh MealPlan for the given week.
   * Locked slots from the current plan are preserved if the weekStart matches.
   */
  generateMealPlan: (weekStart: string) => void;
  /** Toggle the lock on a slot by date. */
  lockSlot: (date: string) => void;
  /**
   * Swap the recipe assigned to a slot with the next best candidate from the
   * algorithm (skipping the current recipe).
   */
  swapSlot: (date: string) => void;
  /**
   * Mark a slot as cooked/skipped and stamp lastCookedAt on the recipe.
   * Called by CookConfirmIntercept when the user taps confirm/skip.
   */
  confirmSlot: (date: string, cooked: boolean) => void;
  /** Clear the recipe from a slot (the ✕ skip action on the tile). */
  skipSlot: (date: string) => void;
  /** Directly assign a recipe to a slot (from RecipePickerModal). */
  assignSlot: (date: string, recipeId: string) => void;
  /**
   * Insert a telemetry-confirmed cook into the plan as a history slot.
   * Used by CookConfirmIntercept when the user cooked something unplanned.
   */
  insertHistorySlot: (date: string, recipeId: string) => void;
  reorderSlots: (orderedDates: string[]) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.order - b.order);
}

/** Returns ISO date string for today at midnight local time, e.g. "2026-05-17" */
function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Extract slots that are in the past and still "pending" — these feed the
 * FIFO intercept queue. Slots for today or the future are excluded.
 */
function getPendingConfirmations(mealPlan: MealPlan | null): MealSlot[] {
  if (!mealPlan) return [];
  const today = todayISO();
  return mealPlan.slots.filter(
    (s) => s.recipeId !== null && s.status === "pending" && s.date < today,
  );
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(defaultAppData);
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const cloudEnabled = isSupabaseConfigured();

  // Keep a ref to the latest user so persistAndSync can always access it
  // without needing to be recreated every time user changes.
  const userRef = useRef<User | null>(null);
  userRef.current = user;
  const unsubscribeRealtimeRef = useRef<(() => void) | undefined>(undefined);
  const isSavingRef = useRef<boolean>(false);
  // The version of the row we last read from (or wrote to) Supabase. Every
  // save is guarded against this — if it's stale, the write is rejected
  // instead of overwriting a newer copy. null = no confirmed row yet
  // (signed out, still loading, or the last fetch was ambiguous).
  const cloudVersionRef = useRef<number | null>(null);

  // ─── Cloud + local save, called directly on every mutation ───────────────
  const persistAndSync = useCallback(
    (updater: (prev: AppData) => AppData) => {
      setData((prev) => {
        const next = updater(prev);

        // 1. Write to localStorage immediately (synchronous, never fails)
        saveAppData(next);

        // 2. Write to Supabase immediately (fire-and-forget, no timer)
        const currentUser = userRef.current;
        if (currentUser && cloudEnabled) {
          setSyncStatus("syncing");
          isSavingRef.current = true;
          const expectedVersion = cloudVersionRef.current;

          saveCloudData(currentUser.id, next, expectedVersion)
            .then(async (result) => {
              if (result.status === "ok") {
                cloudVersionRef.current = result.version;
                setSyncStatus("synced");
                return;
              }

              // Conflict: another device/tab saved first. Never retry blind
              // with our stale copy — pull down whatever's actually there
              // now, so this device converges on the same truth instead of
              // fighting over which write wins.
              const fresh = await fetchCloudData(currentUser.id);
              if (fresh.status === "found") {
                cloudVersionRef.current = fresh.version;
                setData(fresh.data);
                saveAppData(fresh.data);
              }
              setSyncStatus("conflict");
            })
            .catch(() => setSyncStatus("offline"))
            .finally(() => { isSavingRef.current = false; });
        }

        return next;
      });
    },
    [cloudEnabled],
  );

  // ─── Initial load + realtime subscription ────────────────────────────────
  useEffect(() => {
    const supabase = getSupabase();

    if (!supabase) {
      setData(loadAppData());
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
    setData(loadAppData());
    setSyncStatus("local");
    setReady(true);
    return;
  }

  setSyncStatus("syncing");

  const result = await fetchCloudData(currentUser.id);

  if (result.status === "found") {
    // The normal case: a real row exists — use it, full stop.
    setData(result.data);
    saveAppData(result.data);
    cloudVersionRef.current = result.version;
    setSyncStatus("synced");
  } else if (result.status === "not-found") {
    // Supabase POSITIVELY confirmed there's no row for this account yet
    // (not an error, not a timeout — an actual empty result). Only this
    // branch may ever seed + push defaults to the cloud.
    const local = loadAppData();
    const seed = local.recipes.length > 0 ? local : defaultAppData;
    setData(seed);
    try {
      const saveResult = await saveCloudData(currentUser.id, seed, null);
      if (saveResult.status === "ok") {
        cloudVersionRef.current = saveResult.version;
        setSyncStatus("synced");
      } else {
        // Someone/something created a row in the moment between our fetch
        // and our insert (e.g. two devices signing in for the first time
        // at once). Don't fight over it — just re-fetch and take the truth.
        const refetch = await fetchCloudData(currentUser.id);
        if (refetch.status === "found") {
          setData(refetch.data);
          saveAppData(refetch.data);
          cloudVersionRef.current = refetch.version;
          setSyncStatus("synced");
        } else {
          setSyncStatus("offline");
        }
      }
    } catch {
      setSyncStatus("offline");
    }
  } else {
    // Ambiguous / network / query error — this is the case that used to
    // get treated as "empty account" and silently overwrite real data.
    // Never do that: fall back to whatever's cached on this device and
    // leave the cloud row completely untouched until we can confirm what's
    // actually in it.
    cloudVersionRef.current = null;
    setData(loadAppData());
    setSyncStatus("offline");
  }

  // Live push sync: while this tab/device is open, adopt any newer save
  // from another device the moment it happens, instead of only catching up
  // on the next full page load/sign-in. Guarded by version so a stale or
  // duplicate event can never step backwards over a newer local write.
  unsubscribeRealtimeRef.current = subscribeToCloudData(currentUser.id, (fresh, version) => {
    if (cloudVersionRef.current !== null && version <= cloudVersionRef.current) return;
    cloudVersionRef.current = version;
    setData(fresh);
    saveAppData(fresh);
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

  // ─── Keep localStorage in sync with in-memory state (read path only) ─────
  useEffect(() => {
    if (!ready) return;
    saveAppData(data);
  }, [data, ready]);

  // ─── Recipe mutations ─────────────────────────────────────────────────────

  const addRecipe = useCallback(
    (draft: RecipeDraft) => {
      const recipe = createRecipe(draft);
      persistAndSync((prev) => ({ ...prev, recipes: [recipe, ...prev.recipes] }));
      return recipe;
    },
    [persistAndSync],
  );

  const updateRecipeById = useCallback(
    (id: string, draft: RecipeDraft) => {
      persistAndSync((prev) => {
        const prevRecipe = prev.recipes.find((r) => r.id === id);
        const updatedRecipes = prev.recipes.map((r) => (r.id === id ? updateRecipe(r, draft) : r));
        const updatedRecipe = updatedRecipes.find((r) => r.id === id);

        // If lastCookedAt was set, backfill the matching slot's status to "cooked"
        const updatedMealPlan = prev.mealPlan && updatedRecipe?.lastCookedAt
          ? {
              ...prev.mealPlan,
              slots: prev.mealPlan.slots.map((s) =>
                s.recipeId === id && s.date <= todayISO() && s.status === "pending"
                  ? { ...s, status: "cooked" as const }
                  : s,
              ),
            }
          : prev.mealPlan;

        // Kitchen Wrapped: log a cook event whenever this save actually
        // changed lastCookedAt to a new, non-null value — covers both the
        // full edit form and the inline "last cooked" date editor on the
        // recipe page. A save that leaves lastCookedAt untouched (the
        // common case — editing ingredients, etc.) logs nothing.
        const shouldLogCook =
          updatedRecipe?.lastCookedAt != null &&
          updatedRecipe.lastCookedAt !== prevRecipe?.lastCookedAt;
        const updatedCookLog = shouldLogCook
          ? [...prev.cookLog, createCookEvent(updatedRecipe, updatedRecipe.lastCookedAt as string)]
          : prev.cookLog;

        return { ...prev, recipes: updatedRecipes, mealPlan: updatedMealPlan, cookLog: updatedCookLog };
      });
    },
    [persistAndSync],
  );

  const deleteRecipe = useCallback(
    (id: string) => {
      persistAndSync((prev) => ({
        ...prev,
        recipes: prev.recipes.filter((r) => r.id !== id),
      }));
    },
    [persistAndSync],
  );

  // ─── Label mutations ──────────────────────────────────────────────────────

  const addLabel = useCallback(
    (name: string) => {
      const label: Label = { id: createId(), name: name.trim() };
      persistAndSync((prev) => ({ ...prev, labels: [...prev.labels, label] }));
      return label;
    },
    [persistAndSync],
  );

  const updateLabel = useCallback(
    (id: string, name: string) => {
      persistAndSync((prev) => ({
        ...prev,
        labels: prev.labels.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)),
      }));
    },
    [persistAndSync],
  );

  const deleteLabel = useCallback(
    (id: string) => {
      persistAndSync((prev) => ({
        ...prev,
        labels: prev.labels.filter((l) => l.id !== id),
        recipes: prev.recipes.map((r) => ({
          ...r,
          labelIds: r.labelIds.filter((lid) => lid !== id),
        })),
      }));
    },
    [persistAndSync],
  );

  // ─── Folder mutations ─────────────────────────────────────────────────────

  const addFolder = useCallback(
    (label: string, icon: string) => {
      const folder: Folder = {
        id: createId(),
        label: label.trim(),
        icon: icon.trim() || "📁",
        order: 0,
      };
      persistAndSync((prev) => ({
        ...prev,
        folders: sortFolders([
          ...prev.folders.map((f) => ({ ...f, order: f.order + 1 })),
          folder,
        ]),
      }));
      return folder;
    },
    [persistAndSync],
  );

  const updateFolder = useCallback(
    (id: string, label: string, icon: string) => {
      persistAndSync((prev) => ({
        ...prev,
        folders: prev.folders.map((f) =>
          f.id === id ? { ...f, label: label.trim(), icon: icon.trim() || "📁" } : f,
        ),
      }));
    },
    [persistAndSync],
  );

  const deleteFolder = useCallback(
    (id: string) => {
      persistAndSync((prev) => {
        const fallback = prev.folders.find((f) => f.id !== id)?.id ?? "";
        return {
          ...prev,
          folders: prev.folders.filter((f) => f.id !== id),
          recipes: prev.recipes.map((r) =>
            r.folderId === id ? { ...r, folderId: fallback } : r,
          ),
        };
      });
    },
    [persistAndSync],
  );

  const reorderFolders = useCallback(
    (orderedIds: string[]) => {
      persistAndSync((prev) => ({
        ...prev,
        folders: sortFolders(
          prev.folders.map((folder) => ({
            ...folder,
            order: orderedIds.indexOf(folder.id),
          })),
        ),
      }));
    },
    [persistAndSync],
  );

  // ─── Planner actions ──────────────────────────────────────────────────────

  const setPlannerConfig = useCallback(
    (config: PlannerConfig) => {
      persistAndSync((prev) => ({ ...prev, plannerConfig: config }));
    },
    [persistAndSync],
  );

  const generateMealPlan = useCallback(
    (weekStart: string) => {
      persistAndSync((prev) => {
        if (!prev.plannerConfig) return prev;

        // Collect which slots are locked in the *current* plan for this week
        const lockedSlots: Record<string, string | null> = {};
        const today = todayISO();
        if (prev.mealPlan?.weekStart === weekStart) {
          for (const slot of prev.mealPlan.slots) {
            if (slot.isLocked && slot.date >= today) lockedSlots[slot.date] = slot.recipeId;
          }
        }

        const freshPlan = generatePlan(
          weekStart,
          prev.plannerConfig,
          prev.recipes,
          lockedSlots,
        );

        // Preserve any past slots from the existing plan (history should
        // never be wiped by a regeneration or rolling window advance)
        const pastSlots = prev.mealPlan?.slots.filter((s) => s.date < today) ?? [];
        const mergedSlots = [
          ...pastSlots,
          ...freshPlan.slots.filter((s) => s.date >= today),
        ].sort((a, b) => a.date.localeCompare(b.date));

        return { ...prev, mealPlan: { ...freshPlan, slots: mergedSlots } };
      });
    },
    [persistAndSync],
  );

  const lockSlot = useCallback(
    (date: string) => {
      persistAndSync((prev) => {
        if (!prev.mealPlan) return prev;
        return {
          ...prev,
          mealPlan: {
            ...prev.mealPlan,
            slots: prev.mealPlan.slots.map((s) =>
              s.date === date ? { ...s, isLocked: !s.isLocked } : s,
            ),
          },
        };
      });
    },
    [persistAndSync],
  );

  const swapSlot = useCallback(
    (date: string) => {
      persistAndSync((prev) => {
        if (!prev.mealPlan || !prev.plannerConfig) return prev;

        const slot = prev.mealPlan.slots.find((s) => s.date === date);
        if (!slot || slot.isLocked || !slot.recipeId) return prev;

        const currentRecipe = prev.recipes.find((r) => r.id === slot.recipeId);
        if (!currentRecipe) return prev;

        const usedIds = new Set(
          prev.mealPlan.slots.map((s) => s.recipeId).filter(Boolean) as string[],
        );

        // Candidates: same protein type, not already in the plan, passes hard filters
        const candidates = prev.recipes.filter((r) =>
          r.id !== slot.recipeId &&
          !usedIds.has(r.id) &&
          r.proteinType === currentRecipe.proteinType,
        );

        // Score and weighted-pick best candidate
        const scored = candidates
          .map((r) => ({ item: r, weight: scoreRecipe(r) + 200 }))
          .sort((a, b) => b.weight - a.weight);

        const chosen = weightedSample(scored, 1);
        if (!chosen.length) return prev; // no candidate — leave slot unchanged

        return {
          ...prev,
          mealPlan: {
            ...prev.mealPlan,
            slots: prev.mealPlan.slots.map((s) =>
              s.date === date ? { ...s, recipeId: chosen[0].id } : s,
            ),
          },
        };
      });
    },
    [persistAndSync],
  );

  const confirmSlot = useCallback(
    (date: string, cooked: boolean) => {
      persistAndSync((prev) => {
        if (!prev.mealPlan) return prev;

        const slot = prev.mealPlan.slots.find((s) => s.date === date);

        // If cooked, also stamp lastCookedAt on the recipe
        const cookedAt = new Date(date + "T12:00:00").toISOString();
        const updatedRecipes =
          cooked && slot?.recipeId
            ? prev.recipes.map((r) =>
                r.id === slot.recipeId
                ? { ...r, lastCookedAt: cookedAt }
                  : r,
              )
            : prev.recipes;

        // Kitchen Wrapped: log the cook
        const cookedRecipe = cooked && slot?.recipeId
          ? updatedRecipes.find((r) => r.id === slot.recipeId)
          : undefined;
        const updatedCookLog = cookedRecipe
          ? [...prev.cookLog, createCookEvent(cookedRecipe, cookedAt)]
          : prev.cookLog;

        return {
          ...prev,
          recipes: updatedRecipes,
          cookLog: updatedCookLog,
          mealPlan: {
            ...prev.mealPlan,
            slots: prev.mealPlan.slots.map((s) =>
              s.date === date
                ? { ...s, status: cooked ? "cooked" : "skipped" }
                : s,
            ),
          },
        };
      });
    },
    [persistAndSync],
  );

  // ─── Rolling window auto-advance ─────────────────────────────────────────
  // On app load (once data is ready), ensure the meal plan window always starts
  // 7 days back from today and extends forward by daysPerWeek. If the stored
  // plan's weekStart is stale, regenerate from today's window.
  useEffect(() => {
    if (!ready) return;
    if (!data.plannerConfig || !data.mealPlan) return;

    const today = todayISO();
    const expectedStart = (() => {
      const d = new Date(today + "T00:00:00");
      d.setDate(d.getDate() - 7);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

    // If the plan already starts at or after the expected window, leave it alone
    if (data.mealPlan.weekStart >= expectedStart) return;

    generateMealPlan(today);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const reorderSlots = useCallback(
    (orderedDates: string[]) => {
      persistAndSync((prev) => {
        if (!prev.mealPlan) return prev;
        const today = todayISO();
        const pastSlots = prev.mealPlan.slots.filter((s) => s.date < today);
        const upcomingSlots = prev.mealPlan.slots.filter((s) => s.date >= today);
        const lockedByDate = new Map(
          upcomingSlots.filter((s) => s.isLocked).map((s) => [s.date, s]),
        );
        const unlockedSlots = upcomingSlots.filter((s) => !s.isLocked);
        const unlockedDatesNewOrder = orderedDates.filter((d) => !lockedByDate.has(d));
        const recipeIdPool = [...unlockedSlots]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((s) => s.recipeId ?? null);
        const newRecipeByDate = new Map<string, string | null>();
        unlockedDatesNewOrder.forEach((date, i) => {
          newRecipeByDate.set(date, recipeIdPool[i] ?? null);
        });
        const reorderedUpcoming = upcomingSlots.map((slot) => {
          if (slot.isLocked) return slot;
          const newRecipeId = newRecipeByDate.get(slot.date) ?? null;
          const newStatus = newRecipeId && slot.status === "untracked" ? "pending" as const : slot.status;
          return { ...slot, recipeId: newRecipeId, status: newStatus };
        });
        return {
          ...prev,
          mealPlan: {
            ...prev.mealPlan,
            slots: [...pastSlots, ...reorderedUpcoming].sort((a, b) => a.date.localeCompare(b.date)),
          },
        };
      });
    },
    [persistAndSync],
  );

  const skipSlot = useCallback(
    (date: string) => {
      persistAndSync((prev) => {
        if (!prev.mealPlan) return prev;
        return {
          ...prev,
          mealPlan: {
            ...prev.mealPlan,
            slots: prev.mealPlan.slots.map((s) =>
              s.date === date
                ? { ...s, recipeId: null, isLocked: false, status: "untracked" }
                : s,
            ),
          },
        };
      });
    },
    [persistAndSync],
  );

  const assignSlot = useCallback(
    (date: string, recipeId: string) => {
      persistAndSync((prev) => {
        if (!prev.mealPlan) return prev;
        // If the date already exists as a slot, update it
        const exists = prev.mealPlan.slots.some((s) => s.date === date);
        const updatedSlots = exists
          ? prev.mealPlan.slots.map((s) =>
              s.date === date
                ? { ...s, recipeId, status: "pending" as const }
                : s,
            )
          : [
              ...prev.mealPlan.slots,
              { date, recipeId, isLocked: false, status: "pending" as const },
            ].sort((a, b) => a.date.localeCompare(b.date));
        return {
          ...prev,
          mealPlan: { ...prev.mealPlan, slots: updatedSlots },
        };
      });
    },
    [persistAndSync],
  );

  const insertHistorySlot = useCallback(
    (date: string, recipeId: string) => {
      persistAndSync((prev) => {
        if (!prev.mealPlan) return prev;

        // Stamp lastCookedAt on the recipe with the original date
        const cookedAt = new Date(date + "T12:00:00").toISOString();
        const updatedRecipes = prev.recipes.map((r) =>
          r.id === recipeId
            ? { ...r, lastCookedAt: cookedAt }
            : r,
        );

        // Kitchen Wrapped: this always represents a real, telemetry-confirmed
        // cook, so it always logs an event.
        const cookedRecipe = updatedRecipes.find((r) => r.id === recipeId);
        const updatedCookLog = cookedRecipe
          ? [...prev.cookLog, createCookEvent(cookedRecipe, cookedAt)]
          : prev.cookLog;

        // Upsert the slot as cooked
        const exists = prev.mealPlan.slots.some((s) => s.date === date);
        const updatedSlots = exists
          ? prev.mealPlan.slots.map((s) =>
              s.date === date
                ? { ...s, recipeId, status: "cooked" as const }
                : s,
            )
          : [
              ...prev.mealPlan.slots,
              { date, recipeId, isLocked: false, status: "cooked" as const },
            ].sort((a, b) => a.date.localeCompare(b.date));

        return {
          ...prev,
          recipes: updatedRecipes,
          cookLog: updatedCookLog,
          mealPlan: { ...prev.mealPlan, slots: updatedSlots },
        };
      });
    },
    [persistAndSync],
  );

  // ─── Derived: FIFO intercept queue ───────────────────────────────────────
  // Memoised so referential equality is stable — components can safely use
  // pendingConfirmations.length to decide whether to show the intercept.
  const pendingConfirmations = useMemo(
    () => getPendingConfirmations(data.mealPlan),
    [data.mealPlan],
  );

  // ─── Context value ────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      ready,
      recipes: data.recipes,
      labels: data.labels,
      folders: sortFolders(data.folders),
      user,
      syncStatus,
      cloudEnabled,
      plannerConfig: data.plannerConfig,
      mealPlan: data.mealPlan,
      cookLog: data.cookLog,
      pendingConfirmations,
      addRecipe,
      updateRecipeById,
      deleteRecipe,
      addLabel,
      updateLabel,
      deleteLabel,
      addFolder,
      updateFolder,
      deleteFolder,
      reorderFolders,
      setPlannerConfig,
      generateMealPlan,
      lockSlot,
      swapSlot,
      confirmSlot,
      skipSlot,
      assignSlot,
      insertHistorySlot,
      reorderSlots,
    }),
    [
      ready,
      data,
      user,
      syncStatus,
      cloudEnabled,
      pendingConfirmations,
      addRecipe,
      updateRecipeById,
      deleteRecipe,
      addLabel,
      updateLabel,
      deleteLabel,
      addFolder,
      updateFolder,
      deleteFolder,
      reorderFolders,
      setPlannerConfig,
      generateMealPlan,
      lockSlot,
      swapSlot,
      confirmSlot,
      skipSlot,
      assignSlot,
      insertHistorySlot,
      reorderSlots,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}