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
  Folder,
  Label,
  MealPlan,
  MealSlot,
  PlannerConfig,
  Recipe,
  RecipeDraft,
} from "@/lib/types";
import { createRecipe, updateRecipe } from "@/lib/recipeUtils";
import { generatePlan, scoreRecipe, weightedSample } from "@/lib/planner/algorithm";
import type { User } from "@supabase/supabase-js";

type SyncStatus = "local" | "syncing" | "synced" | "offline";

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
          saveCloudData(currentUser.id, next)
            .then(() => setSyncStatus("synced"))
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
  if (!currentUser) {
    unsubscribeRealtimeRef.current?.();
    unsubscribeRealtimeRef.current = undefined;
    setData(loadAppData());
    setSyncStatus("local");
    setReady(true);
    return;
  }

  setSyncStatus("syncing");
  try {
    const cloud = await fetchCloudData(currentUser.id);

    if (cloud) {
      setData(cloud);
      saveAppData(cloud);
    } else {
      const local = loadAppData();
      const seed = local.recipes.length > 0 ? local : defaultAppData;
      setData(seed);
      await saveCloudData(currentUser.id, seed);
    }

    unsubscribeRealtimeRef.current?.();

    setSyncStatus("synced");
  } catch {
    setData(loadAppData());
    setSyncStatus("offline");
  } finally {
    setReady(true);
  }
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

        return { ...prev, recipes: updatedRecipes, mealPlan: updatedMealPlan };
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
          .map((r) => ({ item: r, weight: scoreRecipe(r, prev.plannerConfig!, []) + 200 }))
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
        const updatedRecipes =
          cooked && slot?.recipeId
            ? prev.recipes.map((r) =>
                r.id === slot.recipeId
                ? { ...r, lastCookedAt: new Date(date + "T12:00:00").toISOString() }
                  : r,
              )
            : prev.recipes;

        return {
          ...prev,
          recipes: updatedRecipes,
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
        const updatedRecipes = prev.recipes.map((r) =>
          r.id === recipeId
            ? { ...r, lastCookedAt: new Date(date + "T12:00:00").toISOString() }
            : r,
        );

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