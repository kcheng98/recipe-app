"use client";

/**
 * components/planner/MealPlannerView.tsx
 *
 * The main planner UI.
 *
 * Layout:
 *   ┌────────────────────────────────────────┐
 *   │  Week of May 19 – 23          [⟳ Regen]│
 *   ├────────────────────────────────────────┤
 *   │  Mon 19   [Recipe card]  [🔒] [↻ swap] │
 *   │  Tue 20   [Recipe card]  [🔒] [↻ swap] │
 *   │  …                                     │
 *   └────────────────────────────────────────┘
 *
 * Each day card shows:
 *   - Thumbnail (if available)
 *   - Recipe title
 *   - Lock toggle (shields slot from regeneration)
 *   - Swap button (replaces recipe with next-best alternative)
 *
 * Empty slots show a "+" placeholder.
 *
 * The "Regenerate" button re-runs the algorithm for unlocked slots only.
 * The "Adjust" button re-opens the onboarding modal.
 */

import { useState } from "react";
import { useApp } from "@/context/AppProvider";
import { PlannerOnboarding } from "./PlannerOnboarding";
import type { MealSlot, Recipe } from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** "2026-05-19" → "Mon 19" */
function formatDayLabel(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric" });
}

/** "2026-05-19" → "May 19" */
function formatShort(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Returns ISO date string of the Monday of the current week */
function getCurrentWeekStart(): string {
  const today = new Date();
  const day = today.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setDate(today.getDate() + diff);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function addDays(iso: string, n: number): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── DayCard ──────────────────────────────────────────────────────────────────

function DayCard({
  slot,
  recipe,
  onLock,
  onSwap,
}: {
  slot: MealSlot;
  recipe: Recipe | null;
  onLock: () => void;
  onSwap: () => void;
}) {
  const today = todayISO();
  const isPast = slot.date < today;

  const statusBadge = () => {
    if (slot.status === "cooked")
      return (
        <span className="text-xs font-semibold text-green-600 bg-green-50 rounded-full px-2 py-0.5">
          ✓ Cooked
        </span>
      );
    if (slot.status === "skipped")
      return (
        <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
          Skipped
        </span>
      );
    if (isPast && slot.status === "pending")
      return (
        <span className="text-xs font-semibold text-orange-500 bg-orange-50 rounded-full px-2 py-0.5">
          Pending
        </span>
      );
    return null;
  };

  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3 transition
        ${slot.isLocked ? "border-orange-300 bg-orange-50/40" : "border-gray-100 bg-white"}
        ${isPast ? "opacity-70" : ""}`}
    >
      {/* Thumbnail */}
      <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
        {recipe?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={recipe.imageUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="text-2xl select-none">{recipe ? "🍽️" : "＋"}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-400 mb-0.5">
          {formatDayLabel(slot.date)}
        </p>
        {recipe ? (
          <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
            {recipe.title}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">No recipe assigned</p>
        )}
        <div className="mt-1">{statusBadge()}</div>
      </div>

      {/* Actions */}
      {!isPast && (
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <button
            onClick={onLock}
            title={slot.isLocked ? "Unlock slot" : "Lock slot"}
            className={`w-8 h-8 rounded-xl flex items-center justify-center text-base transition
              ${slot.isLocked
                ? "bg-orange-100 text-orange-500 hover:bg-orange-200"
                : "bg-gray-100 text-gray-400 hover:bg-orange-50 hover:text-orange-400"}`}
          >
            {slot.isLocked ? "🔒" : "🔓"}
          </button>
          {!slot.isLocked && recipe && (
            <button
              onClick={onSwap}
              title="Swap recipe"
              className="w-8 h-8 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center
                         hover:bg-blue-50 hover:text-blue-500 transition text-sm font-bold"
            >
              ↻
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MealPlannerView() {
  const {
    mealPlan,
    plannerConfig,
    recipes,
    generateMealPlan,
    lockSlot,
    swapSlot,
  } = useApp();

  const [showOnboarding, setShowOnboarding] = useState(false);

  // If no config yet, show nothing — the onboarding intercept handles this
  if (!plannerConfig) return null;

  const weekStart = mealPlan?.weekStart ?? getCurrentWeekStart();
  const slots = mealPlan?.slots ?? [];

  // Week header label: "May 19 – 23"
  const weekEnd =
    slots.length > 0
      ? slots[slots.length - 1].date
      : addDays(weekStart, plannerConfig.daysPerWeek - 1);
  const weekLabel = `${formatShort(weekStart)} – ${formatShort(weekEnd)}`;

  const handleRegenerate = () => {
    generateMealPlan(weekStart);
  };

  return (
    <>
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Meal Plan</h1>
            <p className="text-xs text-gray-400 mt-0.5">Week of {weekLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowOnboarding(true)}
              className="text-xs font-semibold text-gray-500 hover:text-orange-500 transition px-2 py-1.5 rounded-xl hover:bg-orange-50"
            >
              Adjust
            </button>
            <button
              onClick={handleRegenerate}
              className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-bold
                         px-3 py-2 rounded-xl shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
            >
              <span className="text-sm">⟳</span> Regenerate
            </button>
          </div>
        </div>

        {/* Day cards */}
        {slots.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-4xl mb-3">📅</p>
            <p className="text-sm font-medium">No plan generated yet.</p>
            <button
              onClick={handleRegenerate}
              className="mt-4 text-sm font-semibold text-orange-500 hover:underline"
            >
              Generate now →
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {slots.map((slot) => {
              const recipe = slot.recipeId
                ? (recipes.find((r) => r.id === slot.recipeId) ?? null)
                : null;
              return (
                <DayCard
                  key={slot.date}
                  slot={slot}
                  recipe={recipe}
                  onLock={() => lockSlot(slot.date)}
                  onSwap={() => swapSlot(slot.date)}
                />
              );
            })}
          </div>
        )}

        {/* Config summary footer */}
        <div className="mt-6 p-3 rounded-2xl bg-gray-50 border border-gray-100">
          <p className="text-xs text-gray-400 font-medium">
            {plannerConfig.daysPerWeek} dinners/week ·{" "}
            {plannerConfig.enabledStores.join(", ")} stores
          </p>
        </div>
      </div>

      <PlannerOnboarding
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />
    </>
  );
}
