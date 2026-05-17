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
import type { AppData, Folder, Label, Recipe, RecipeDraft } from "@/lib/types";
import { createRecipe, updateRecipe } from "@/lib/recipeUtils";
import type { User } from "@supabase/supabase-js";

type SyncStatus = "local" | "syncing" | "synced" | "offline";

type AppContextValue = {
  ready: boolean;
  recipes: Recipe[];
  labels: Label[];
  folders: Folder[];
  user: User | null;
  syncStatus: SyncStatus;
  cloudEnabled: boolean;
  addRecipe: (draft: RecipeDraft) => Recipe;
  updateRecipeById: (id: string, draft: RecipeDraft) => void;
  deleteRecipe: (id: string) => void;
  addLabel: (name: string) => Label;
  updateLabel: (id: string, name: string) => void;
  deleteLabel: (id: string) => void;
  addFolder: (label: string, icon: string) => Folder;
  updateFolder: (id: string, label: string, icon: string) => void;
  deleteFolder: (id: string) => void;
  reorderFolders: (orderedIds: string[]) => void;
};

function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => a.order - b.order);
}

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
  // This replaces the old debounced useEffect approach, which was cancelled
  // whenever the component re-rendered (e.g. on navigation), causing recipes
  // to never reach Supabase.
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
          // Cloud is always the source of truth — never let localStorage win
          setData(cloud);
          saveAppData(cloud);
        } else {
          // No cloud row yet — seed it from localStorage once
          const local = loadAppData();
          const seed = local.recipes.length > 0 ? local : defaultAppData;
          setData(seed);
          await saveCloudData(currentUser.id, seed);
        }

        // Subscribe to realtime changes from other devices
        unsubscribeRealtime = subscribeToCloudData(currentUser.id, (fresh) => {
          setData(fresh);
          saveAppData(fresh);
        });

        setSyncStatus("synced");
      } catch {
        // Network error — show local data read-only, never write back to cloud
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
      // Skip the immediate echo that Supabase fires on subscription setup
      if (!initialLoadDone) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);
      userRef.current = currentUser;

      if (!currentUser) {
        unsubscribeRealtime?.();
        setSyncStatus("local");
      } else {
        // New tab / token refresh — re-fetch cloud to get latest data
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
  // This only runs on initial hydration. All write-path saves happen in
  // persistAndSync above.
  useEffect(() => {
    if (!ready) return;
    saveAppData(data);
  }, [data, ready]);

  // ─── Mutations ────────────────────────────────────────────────────────────

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
    }),
    [
      ready,
      data,
      user,
      syncStatus,
      cloudEnabled,
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
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
