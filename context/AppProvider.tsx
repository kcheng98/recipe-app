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
import { generatePlan } from "@/lib/planner/algorithm";
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
          saveCloudData(currentUser.id, next)
            .then(() => setSyncStatus("synced"))
            .catch(() => setSyncStatus("offline"));
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

    let unsubscribeRealtime: (() => void) | undefined;
    let initialLoadDone = false;

    async function loadForUser(currentUser: User | null) {
      if (!currentUser) {
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

        unsubscribeRealtime = subscribeToCloudData(currentUser.id, (fresh) => {
          setData(fresh);
          saveAppData(fresh);
        });

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!initialLoadDone) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      userRef.current = currentUser;

      if (!currentUser) {
        unsubscribeRealtime?.();
        setSyncStatus("local");
      } else {
        unsubscribeRealtime?.();
        loadForUser(currentUser);
      }
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeRealtime?.();
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
      persistAndSync((prev) => ({
        ...prev,
        recipes: prev.recipes.map((r) => (r.id === id ? updateRecipe(r, draft) : r)),
      }));
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
        if (prev.mealPlan?.weekStart === weekStart) {
          for (const slot of prev.mealPlan.slots) {
            if (slot.isLocked) lockedSlots[slot.date] = slot.recipeId;
          }
        }

        const freshPlan = generatePlan(
          weekStart,
          prev.plannerConfig,
          prev.recipes,
          lockedSlots,
        );

        return { ...prev, mealPlan: freshPlan };
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
        if (!slot || slot.isLocked) return prev;

        // Re-run the algorithm with the current recipe excluded from this slot
        const lockedSlots: Record<string, string | null> = {};
        for (const s of prev.mealPlan.slots) {
          if (s.isLocked || s.date !== date) {
            lockedSlots[s.date] = s.recipeId;
          }
        }
        // Mark the current recipe as excluded for this slot by passing it as a
        // locked placeholder for a dummy date — instead, re-generate with a
        // blacklist of one recipe.
        const excluded = slot.recipeId ? new Set([slot.recipeId]) : new Set<string>();
        const freshPlan = generatePlan(
          prev.mealPlan.weekStart,
          prev.plannerConfig,
          prev.recipes,
          lockedSlots,
          excluded,
        );

        // Merge: preserve non-swapped slots, take the new assignment for `date`
        const newSlot = freshPlan.slots.find((s) => s.date === date);
        return {
          ...prev,
          mealPlan: {
            ...prev.mealPlan,
            slots: prev.mealPlan.slots.map((s) =>
              s.date === date && newSlot ? { ...newSlot } : s,
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
                  ? { ...r, lastCookedAt: new Date().toISOString() }
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}