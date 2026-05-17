"use client";

/**
 * components/planner/CookConfirmIntercept.tsx
 *
 * FIFO intercept screen shown on app load whenever there are past meal slots
 * that are still "pending" (the user hasn't confirmed whether they cooked them).
 *
 * Shows one slot at a time in date order (oldest first).
 * - "Yes, I made it!" → confirmSlot(date, true)  → stamps lastCookedAt
 * - "No, I skipped it" → confirmSlot(date, false) → marks skipped
 *
 * When the queue is empty, calls onDone() and the component disappears.
 *
 * Usage: render this at the top level of your app (e.g. in layout.tsx or the
 * planner page). It mounts invisibly when the queue is empty and only presents
 * when there's something to confirm.
 */

import { useEffect, useState } from "react";
import { useApp } from "@/context/AppProvider";
import type { MealSlot } from "@/lib/types";

interface Props {
  /** Called once the queue is fully drained */
  onDone?: () => void;
}

/** Format "2026-05-17" → "Saturday, May 17" */
function formatDate(iso: string): string {
  // Parse as local date to avoid timezone offset shifting the day
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

export function CookConfirmIntercept({ onDone }: Props) {
  const { pendingConfirmations, confirmSlot, recipes } = useApp();

  // Local pointer into the queue. We drive off the live pendingConfirmations
  // array (which shrinks as we confirm), so we always show pendingConfirmations[0].
  const [animating, setAnimating] = useState(false);

  const current: MealSlot | undefined = pendingConfirmations[0];

  // When queue empties, fire onDone
  useEffect(() => {
    if (pendingConfirmations.length === 0) {
      onDone?.();
    }
  }, [pendingConfirmations.length, onDone]);

  if (!current) return null;

  const recipe = current.recipeId
    ? recipes.find((r) => r.id === current.recipeId)
    : null;

  const handle = (cooked: boolean) => {
    if (animating) return;
    setAnimating(true);
    // Brief delay for exit animation, then confirm (which removes it from the queue)
    setTimeout(() => {
      confirmSlot(current.date, cooked);
      setAnimating(false);
    }, 180);
  };

  return (
    // Full-screen backdrop — intentionally blocks interaction until queue is drained
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div
        className={`w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden
          transition-all duration-200 ${animating ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
      >
        {/* Recipe image or placeholder */}
        <div className="relative h-44 bg-orange-50 flex items-center justify-center overflow-hidden">
          {recipe?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl select-none">🍽️</span>
          )}
          {/* Queue badge */}
          {pendingConfirmations.length > 1 && (
            <span className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
              {pendingConfirmations.length} remaining
            </span>
          )}
        </div>

        <div className="px-6 py-5">
          {/* Header */}
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">
            {formatDate(current.date)}
          </p>
          <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">
            Did you cook this?
          </h2>
          {recipe ? (
            <p className="text-sm text-gray-500 mb-6 line-clamp-2">{recipe.title}</p>
          ) : (
            <p className="text-sm text-gray-400 italic mb-6">Recipe no longer in library</p>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <button
              onClick={() => handle(true)}
              className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-bold text-sm
                         shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
            >
              ✓ Yes, I made it!
            </button>
            <button
              onClick={() => handle(false)}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold
                         text-sm hover:bg-gray-50 active:scale-95 transition-all"
            >
              No, I skipped it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
