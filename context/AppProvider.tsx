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
  const skipNextSave = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback((updater: (prev: AppData) => AppData) => {
    setData(updater);
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
  
    if (!supabase) {
      setData(loadAppData());
      setSyncStatus("local");
      setReady(true);
      return;
    }
  
    let unsubscribeRealtime: (() => void) | undefined;
  
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
          // Cloud is the source of truth — ALWAYS prefer it
          setData(cloud);
          saveAppData(cloud);
        } else {
          // No cloud row exists yet — push local up once
          const local = loadAppData();
          const seed = local.recipes.length > 0 ? local : defaultAppData;
          setData(seed);
          await saveCloudData(currentUser.id, seed);
        }
  
        unsubscribeRealtime = subscribeToCloudData(currentUser.id, (fresh) => {
          skipNextSave.current = true;
          setData(fresh);
          saveAppData(fresh);
        });
  
        setSyncStatus("synced");
      } catch {
        // Network failed — use localStorage as read-only fallback, never write back
        setData(loadAppData());
        setSyncStatus("offline");
      } finally {
        setReady(true);
      }
    }
  
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      loadForUser(currentUser);
    });
  
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        if (!currentUser) {
          unsubscribeRealtime?.();
          setSyncStatus("local");
        } else {
          // Re-fetch cloud when auth state changes (new tab, sign-in, token refresh)
          unsubscribeRealtime?.();
          loadForUser(currentUser);
        }
      }
    );
  
    return () => {
      subscription.unsubscribe();
      unsubscribeRealtime?.();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveAppData(data);

    if (!user || !cloudEnabled) return;

    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSyncStatus("syncing");

    saveTimer.current = setTimeout(async () => {
      try {
        await saveCloudData(user.id, data);
        setSyncStatus("synced");
      } catch {
        setSyncStatus("offline");
      }
    }, 800);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [data, ready, user, cloudEnabled]);

  const addRecipe = useCallback((draft: RecipeDraft) => {
    const recipe = createRecipe(draft);
    persist((prev) => ({ ...prev, recipes: [recipe, ...prev.recipes] }));
    return recipe;
  }, [persist]);

  const updateRecipeById = useCallback((id: string, draft: RecipeDraft) => {
    persist((prev) => ({
      ...prev,
      recipes: prev.recipes.map((r) =>
        r.id === id ? updateRecipe(r, draft) : r,
      ),
    }));
  }, [persist]);

  const deleteRecipe = useCallback((id: string) => {
    persist((prev) => ({
      ...prev,
      recipes: prev.recipes.filter((r) => r.id !== id),
    }));
  }, [persist]);

  const addLabel = useCallback((name: string) => {
    const label: Label = { id: createId(), name: name.trim() };
    persist((prev) => ({ ...prev, labels: [...prev.labels, label] }));
    return label;
  }, [persist]);

  const updateLabel = useCallback((id: string, name: string) => {
    persist((prev) => ({
      ...prev,
      labels: prev.labels.map((l) =>
        l.id === id ? { ...l, name: name.trim() } : l,
      ),
    }));
  }, [persist]);

  const deleteLabel = useCallback((id: string) => {
    persist((prev) => ({
      ...prev,
      labels: prev.labels.filter((l) => l.id !== id),
      recipes: prev.recipes.map((r) => ({
        ...r,
        labelIds: r.labelIds.filter((lid) => lid !== id),
      })),
    }));
  }, [persist]);

  const addFolder = useCallback((label: string, icon: string) => {
    const folder: Folder = {
      id: createId(),
      label: label.trim(),
      icon: icon.trim() || "📁",
      order: 0,
    };
    persist((prev) => ({
      ...prev,
      folders: sortFolders([
        ...prev.folders.map((f) => ({ ...f, order: f.order + 1 })),
        folder,
      ]),
    }));
    return folder;
  }, [persist]);

  const reorderFolders = useCallback((orderedIds: string[]) => {
    persist((prev) => ({
      ...prev,
      folders: sortFolders(
        prev.folders.map((folder) => ({
          ...folder,
          order: orderedIds.indexOf(folder.id),
        })),
      ),
    }));
  }, [persist]);

  const updateFolder = useCallback((id: string, label: string, icon: string) => {
    persist((prev) => ({
      ...prev,
      folders: prev.folders.map((f) =>
        f.id === id ? { ...f, label: label.trim(), icon: icon.trim() || "📁" } : f,
      ),
    }));
  }, [persist]);

  const deleteFolder = useCallback((id: string) => {
    persist((prev) => {
      const fallback = prev.folders.find((f) => f.id !== id)?.id ?? "";
      return {
        ...prev,
        folders: prev.folders.filter((f) => f.id !== id),
        recipes: prev.recipes.map((r) =>
          r.folderId === id ? { ...r, folderId: fallback } : r,
        ),
      };
    });
  }, [persist]);

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
