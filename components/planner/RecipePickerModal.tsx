"use client";

/**
 * components/planner/RecipePickerModal.tsx
 *
 * Triggered by the ＋ icon on a meal tile.
 * Shows all recipes, searchable. Selecting one assigns it to the slot.
 */

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppProvider";
import type { Recipe } from "@/lib/types";

interface Props {
  /** The date of the slot being filled, e.g. "2026-05-19". Null = closed. */
  date: string | null;
  onClose: () => void;
}

const PROTEIN_EMOJI: Record<string, string> = {
  poultry: "🍗",
  "fish-seafood": "🐟",
  "red-meat": "🥩",
  vegetarian: "🌱",
  vegan: "🌱",
  none: "🍽️",
};

function formatDayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function RecipeRow({
  recipe,
  onSelect,
}: {
  recipe: Recipe;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-50 transition text-left"
    >
      {/* Thumbnail */}
      <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
        {recipe.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={recipe.imageUrl} alt={recipe.title} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">{PROTEIN_EMOJI[recipe.proteinType ?? "none"] ?? "🍽️"}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 leading-snug line-clamp-1">
          {recipe.title}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">
          {PROTEIN_EMOJI[recipe.proteinType ?? "none"]} {recipe.proteinType ?? "—"}
          {recipe.totalTime ? ` · ⏱ ${recipe.totalTime}` : ""}
        </p>
      </div>

      <span className="text-orange-400 text-lg flex-shrink-0">＋</span>
    </button>
  );
}

export function RecipePickerModal({ date, onClose }: Props) {
  const { recipes, assignSlot } = useApp();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.title.toLowerCase().includes(q));
  }, [recipes, query]);

  const handleSelect = (recipe: Recipe) => {
    if (!date) return;
    assignSlot(date, recipe.id);
    onClose();
  };

  if (!date) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mt-4 mb-1 sm:hidden flex-shrink-0" />

        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex-shrink-0">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-bold text-gray-900">Assign a recipe</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center
                         text-gray-400 hover:bg-gray-200 transition text-sm font-bold"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">{formatDayLabel(date)}</p>

          {/* Search */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search recipes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm
                         focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 flex-shrink-0" />

        {/* Recipe list */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <p className="text-3xl mb-2">🍽️</p>
              <p className="text-sm">No recipes match "{query}"</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((recipe) => (
                <RecipeRow
                  key={recipe.id}
                  recipe={recipe}
                  onSelect={() => handleSelect(recipe)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}