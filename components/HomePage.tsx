"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import ManageFoldersModal from "@/components/ManageFoldersModal";
import ManageLabelsModal from "@/components/ManageLabelsModal";
import RecipeCard from "@/components/RecipeCard";
import SearchBar from "@/components/SearchBar";
import Sidebar from "@/components/Sidebar";
import TagFilter from "@/components/TagFilter";
import { useApp } from "@/context/AppProvider";
import { ALL_FOLDER_ID } from "@/lib/defaults";
import type { StoreTier } from "@/lib/types";

export default function HomePage() {
  const { ready, recipes, labels, folders } = useApp();
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState(ALL_FOLDER_ID);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const folder = params.get("folder");
    if (folder) setActiveFolder(folder);
  }, []);
  const [activeLabelId, setActiveLabelId] = useState("all");
  const [activeVibe, setActiveVibe] = useState("all");
  const [activeMarket, setActiveMarket] = useState("all");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [foldersModalOpen, setFoldersModalOpen] = useState(false);
  const [labelsModalOpen, setLabelsModalOpen] = useState(false);
  const [activeProtein, setActiveProtein] = useState("all");

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
  
    return recipes.filter((recipe) => {
      const matchesFolder =
        activeFolder === ALL_FOLDER_ID || recipe.folderId === activeFolder;
  
      const matchesLabel =
        activeLabelId === "all" || recipe.labelIds.includes(activeLabelId);
  
      const matchesVibe =
        activeVibe === "all" || recipe.vibe === activeVibe;
  
      const matchesMarket =
        activeMarket === "all" ||
        (recipe.supportedStores ?? ["Standard"]).includes(activeMarket as StoreTier);
      
      const matchesProtein =
        activeProtein === "all" || recipe.proteinType === activeProtein;
  
      const matchesSearch =
        query === "" ||
        recipe.title.toLowerCase().includes(query) ||
        recipe.description.toLowerCase().includes(query);
  
      return matchesFolder && matchesLabel && matchesVibe && matchesMarket && matchesProtein && matchesSearch;
    });
  }, [search, activeFolder, activeLabelId, activeVibe, activeMarket, activeProtein, recipes, labels]);

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


      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
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

  {/* Row 1: Search + Moods + Markets */}
  <div className="mt-4 flex gap-2 lg:mt-0">
    <div className="flex-1">
      <SearchBar value={search} onChange={setSearch} />
    </div>
    <select
      value={activeVibe}
      onChange={(e) => setActiveVibe(e.target.value)}
      className="rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-sm text-[#1d1d1f] shadow-sm appearance-none pr-8 cursor-pointer"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
    >
      <option value="all">All Moods</option>
      <option value="light-fresh">🌿 Light &amp; Fresh</option>
      <option value="all-weather">☁️ All-Weather</option>
      <option value="heavy-rich">🍲 Heavy &amp; Rich</option>
    </select>
    <select
      value={activeMarket}
      onChange={(e) => setActiveMarket(e.target.value)}
      className="rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-sm text-[#1d1d1f] shadow-sm appearance-none pr-8 cursor-pointer"
      style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2386868b' stroke-width='2'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
    >
      <option value="all">All Markets</option>
      <option value="Standard">🛒 Standard</option>
      <option value="Asian">🏮 Asian Market</option>
      <option value="Premium">✨ Premium</option>
    </select>
  </div>

  {/* Row 2: Protein pills */}
  <div className="mt-3 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {(["all", "poultry", "red-meat", "fish-seafood", "vegetarian"] as const).map((val) => {
        const label = val === "all" ? "All Protein" : val === "poultry" ? "Poultry" : val === "red-meat" ? "Red Meat" : val === "fish-seafood" ? "Fish & Seafood" : "Veg / Vegan";
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
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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