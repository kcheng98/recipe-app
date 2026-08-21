"use client";

import Link from "next/link";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import ManageFoldersModal from "@/components/ManageFoldersModal";
import ManageLabelsModal from "@/components/ManageLabelsModal";
import RecipeCard from "@/components/RecipeCard";
import SearchBar from "@/components/SearchBar";
import Sidebar from "@/components/Sidebar";
import TagFilter from "@/components/TagFilter";
import { useApp } from "@/context/AppProvider";
import { ALL_FOLDER_ID } from "@/lib/defaults";
import { sortRecipesForDisplay } from "@/lib/recipeUtils";

/**
 * Next.js's App Router does not preserve a page component's local React
 * state across navigation — even navigating "back" tears down and rebuilds
 * this component from scratch, so filters/search reset to their defaults
 * every time you return here. To make "come back to where I was" actually
 * work, the filter selections and scroll position are mirrored into
 * sessionStorage (scoped to this browser tab) and restored on mount.
 */
type HomeViewState = {
  search?: string;
  activeFolder?: string;
  activeLabelId?: string;
  activeVibe?: string;
  activeProtein?: string;
  scrollTop?: number;
};

const HOME_VIEW_STATE_KEY = "recipe-app-home-view-v1";

function readHomeViewState(): HomeViewState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(HOME_VIEW_STATE_KEY);
    return raw ? (JSON.parse(raw) as HomeViewState) : null;
  } catch {
    return null;
  }
}

function writeHomeViewState(patch: HomeViewState): void {
  if (typeof window === "undefined") return;
  try {
    const current = readHomeViewState() ?? {};
    sessionStorage.setItem(
      HOME_VIEW_STATE_KEY,
      JSON.stringify({ ...current, ...patch }),
    );
  } catch {
    // sessionStorage unavailable (private browsing, quota, etc.) — the view
    // just won't restore; not worth surfacing an error for.
  }
}

export default function HomePage() {
  const { ready, recipes, labels, folders } = useApp();
  const [search, setSearch] = useState(() => readHomeViewState()?.search ?? "");
  const [activeFolder, setActiveFolder] = useState(
    () => readHomeViewState()?.activeFolder ?? ALL_FOLDER_ID,
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folder = params.get("folder");
    if (folder) setActiveFolder(folder);
  }, []);
  const [activeLabelId, setActiveLabelId] = useState(
    () => readHomeViewState()?.activeLabelId ?? "all",
  );
  const [activeVibe, setActiveVibe] = useState(
    () => readHomeViewState()?.activeVibe ?? "all",
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [foldersModalOpen, setFoldersModalOpen] = useState(false);
  const [labelsModalOpen, setLabelsModalOpen] = useState(false);
  const [activeProtein, setActiveProtein] = useState(
    () => readHomeViewState()?.activeProtein ?? "all",
  );

  // Persist filter selections as they change.
  useEffect(() => {
    writeHomeViewState({ search, activeFolder, activeLabelId, activeVibe, activeProtein });
  }, [search, activeFolder, activeLabelId, activeVibe, activeProtein]);

  // Persist + restore scroll position of the recipe list itself (it's the
  // scrollable region here, not the window).
  const scrollRef = useRef<HTMLElement>(null);
  const hasRestoredScroll = useRef(false);

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      writeHomeViewState({ scrollTop: scrollRef.current.scrollTop });
    }
  }, []);

  const labelFilterOptions = useMemo(
    () => ["all", ...labels.map((l) => l.id)],
    [labels],
  );

  const labelFilterLabels = useMemo(
    () => ({
      all: "All labels",
      ...Object.fromEntries(labels.map((l) => [l.id, l.name])),
    }),
    [labels],
  );

  const filteredRecipes = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = recipes.filter((recipe) => {
      const matchesFolder =
        activeFolder === ALL_FOLDER_ID || recipe.folderId === activeFolder;
  
      const matchesLabel =
        activeLabelId === "all" || recipe.labelIds.includes(activeLabelId);
  
      const matchesVibe =
        activeVibe === "all" || recipe.vibe === activeVibe;

      const matchesProtein =
        activeProtein === "all" || recipe.proteinType === activeProtein;

      // Match on the title only — it's the one field you actually see and
      // edit. (description is an internal field, silently populated from
      // import scraping or the title itself, and never shown/editable, so
      // matching against it produced results with no visible connection to
      // the search term.)
      const matchesSearch =
        query === "" || recipe.title.toLowerCase().includes(query);

      return matchesFolder && matchesLabel && matchesVibe && matchesProtein && matchesSearch;
    });

    return sortRecipesForDisplay(filtered, folders);
  }, [search, activeFolder, activeLabelId, activeVibe, activeProtein, recipes, labels, folders]);

  // Restore scroll position once, after the (correctly filtered/sorted)
  // list has actually rendered — restoring any earlier just clips against
  // a list that isn't tall enough yet.
  useEffect(() => {
    if (!ready || hasRestoredScroll.current || !scrollRef.current) return;
    const saved = readHomeViewState()?.scrollTop;
    if (typeof saved === "number") {
      scrollRef.current.scrollTop = saved;
    }
    hasRestoredScroll.current = true;
  }, [ready, filteredRecipes]);

  const activeFolderLabel =
    activeFolder === ALL_FOLDER_ID
      ? "All Recipes"
      : (folders.find((f) => f.id === activeFolder)?.label ?? "Recipes");

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading your recipes…
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        folders={folders}
        activeFolder={activeFolder}
        onFolderSelect={setActiveFolder}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onManageFolders={() => setFoldersModalOpen(true)}
        onManageLabels={() => setLabelsModalOpen(true)}
      />

      <ManageFoldersModal
        open={foldersModalOpen}
        onClose={() => setFoldersModalOpen(false)}
      />
      <ManageLabelsModal
        open={labelsModalOpen}
        onClose={() => setLabelsModalOpen(false)}
      />


      <main
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex min-w-0 flex-1 flex-col overflow-y-auto"
      >
      <header className="sticky top-0 z-30 border-b border-[#e5e5ea]/80 bg-[#f5f5f7]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
  {/* Mobile: folder button + title + add */}
  <div className="flex items-center justify-between gap-3 lg:hidden">
    <button
      type="button"
      aria-label="Open folders"
      onClick={() => setSidebarOpen(true)}
      className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#1d1d1f] shadow-sm ring-1 ring-[#e5e5ea]"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-[#86868b]">Our Recipes</p>
      <p className="text-sm font-semibold text-[#1d1d1f]">{activeFolderLabel}</p>
    </div>
    <Link href="/recipes/new" className="rounded-xl bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white">
      Add
    </Link>
  </div>

  {/* Row 1: Search + Moods */}
  <div className="mt-4 flex flex-wrap gap-2 lg:mt-0 lg:flex-nowrap">
    <div className="w-full lg:flex-1">
      <SearchBar value={search} onChange={setSearch} />
    </div>
    <select
      value={activeVibe}
      onChange={(e) => setActiveVibe(e.target.value)}
      className="w-[calc(50%-4px)] lg:w-auto rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-sm text-[#1d1d1f] shadow-sm appearance-none pr-8 cursor-pointer"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
    >
      <option value="all">All Moods</option>
      <option value="light-fresh">🌿 Light &amp; Fresh</option>
      <option value="all-weather">☁️ All-Weather</option>
      <option value="heavy-rich">🍲 Heavy &amp; Rich</option>
    </select>
  </div>

  {/* Row 2: Protein pills */}
  <div className="mt-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {(["all", "poultry", "red-meat", "pork", "fish-seafood", "vegetarian"] as const).map((val) => {
        const label = val === "all" ? "All Protein" : val === "poultry" ? "Poultry" : val === "red-meat" ? "Red Meat" : val === "pork" ? "Pork" : val === "fish-seafood" ? "Fish & Seafood" : "Veg / Vegan";
        const active = activeProtein === val;
        return (
          <button
            key={val}
            type="button"
            onClick={() => setActiveProtein(val)}
            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition
              ${active ? "bg-[#1d1d1f] text-white" : "bg-white text-[#1d1d1f] ring-1 ring-[#e5e5ea] hover:ring-[#c7c7cc]"}`}
          >
            {label}
          </button>
        );
      })}
    </div>
  </div>

  {/* Row 3: Label pills */}
  {labels.length > 0 && (
    <div className="mt-3">
      <TagFilter
        categories={labelFilterOptions.map(
          (id) => labelFilterLabels[id as keyof typeof labelFilterLabels] ?? id,
        )}
        activeCategory={
          activeLabelId === "all"
            ? "All labels"
            : (labels.find((l) => l.id === activeLabelId)?.name ?? "")
        }
        onSelect={(name) => {
          if (name === "All labels") setActiveLabelId("all");
          else {
            const label = labels.find((l) => l.name === name);
            if (label) setActiveLabelId(label.id);
          }
        }}
      />
    </div>
  )}
</header>

        <section className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1d1d1f]">
                {activeFolderLabel}
              </h2>
              <p className="mt-1 text-sm text-[#86868b]">
                {filteredRecipes.length}{" "}
                {filteredRecipes.length === 1 ? "recipe" : "recipes"}
              </p>
            </div>
            <Link
              href="/recipes/new"
              className="hidden rounded-xl bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0077ed] lg:inline-flex"
            >
              + Add recipe
            </Link>
          </div>

          {filteredRecipes.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4">
              {filteredRecipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  labels={labels}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl bg-white px-6 py-16 text-center ring-1 ring-[#e5e5ea]">
              <p className="text-lg font-medium text-[#1d1d1f]">
                No recipes found
              </p>
              <p className="mt-2 max-w-sm text-sm text-[#86868b]">
                Try a different search, folder, or label—or add your first recipe.
              </p>
              <Link
                href="/recipes/new"
                className="mt-6 rounded-xl bg-[#0071e3] px-6 py-3 text-sm font-semibold text-white"
              >
                Add recipe
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}