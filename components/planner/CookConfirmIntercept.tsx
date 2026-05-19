"use client";

/**
 * components/planner/CookConfirmIntercept.tsx
 *
 * Merged FIFO intercept queue, compiled on app load from two sources:
 *
 *   Source 1 — Past planner slots with status "pending" and a recipeId.
 *   Source 2 — Ambient telemetry: pending-cook flags written by
 *              useSessionTracking (localStorage keys "pending-cook:*").
 *
 * For a given date:
 *   • Only Source 1  → one prompt: "Did you cook [Planned]?"
 *   • Only Source 2  → one prompt: "Did you cook [Telemetry]?"
 *   • Both, same recipe → one prompt (deduplicated)
 *   • Both, different recipes →
 *       Step A: "Did you cook [Planned]?"
 *         Yes → stamp + done for this date
 *         No  → mark slot skipped, then…
 *       Step B: "Did you cook [Telemetry] instead?"
 *         Yes → stamp + insert into history
 *         No  → clear flag, move on
 *
 * All confirmations stamp the ORIGINAL slot/session date onto lastCookedAt.
 */

import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppProvider";
import {
  clearPendingCookFlag,
  getPendingCookFlags,
} from "@/hooks/useSessionTracking";
import type { MealSlot, Recipe } from "@/lib/types";

interface Props {
  onDone?: () => void;
}

// ─── Queue item types ─────────────────────────────────────────────────────────

type SinglePrompt = {
  kind: "single";
  date: string;
  recipeId: string;
  source: "planner" | "telemetry";
};

type DualPromptA = {
  kind: "dual-a"; // "Did you cook [Planned]?"
  date: string;
  plannedRecipeId: string;
  telemetryRecipeId: string;
};

type DualPromptB = {
  kind: "dual-b"; // "Did you cook [Telemetry] instead?"
  date: string;
  telemetryRecipeId: string;
};

type QueueItem = SinglePrompt | DualPromptA | DualPromptB;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function buildQueue(
  pendingSlots: MealSlot[],
): QueueItem[] {
  const telemetryFlags = getPendingCookFlags(); // sorted oldest-first
  const telemetryByDate = new Map(
    telemetryFlags.map((f) => [f.date, f.recipeId]),
  );

  // Collect all dates involved, sorted chronologically
  const allDates = Array.from(
    new Set([
      ...pendingSlots.map((s) => s.date),
      ...telemetryFlags.map((f) => f.date),
    ]),
  ).sort();

  const items: QueueItem[] = [];

  for (const date of allDates) {
    const slot = pendingSlots.find((s) => s.date === date);
    const telemetryId = telemetryByDate.get(date);

    const plannedId = slot?.recipeId ?? null;

    if (plannedId && telemetryId && plannedId !== telemetryId) {
      // Both sources, different recipes → two-step
      items.push({ kind: "dual-a", date, plannedRecipeId: plannedId, telemetryRecipeId: telemetryId });
      // dual-b is pushed dynamically after the user says "No" to dual-a
    } else if (plannedId) {
      items.push({ kind: "single", date, recipeId: plannedId, source: "planner" });
    } else if (telemetryId) {
      items.push({ kind: "single", date, recipeId: telemetryId, source: "telemetry" });
    }
  }

  return items;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CookConfirmIntercept({ onDone }: Props) {
  const { pendingConfirmations, confirmSlot, insertHistorySlot, recipes } = useApp();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [animating, setAnimating] = useState(false);
  const initialized = useRef(false);

  // Build the queue once on mount (not reactive — we don't want it to rebuild
  // mid-session as confirmSlot drains pendingConfirmations)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setQueue(buildQueue(pendingConfirmations));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fire onDone when queue empties
  useEffect(() => {
    if (initialized.current && queue.length === 0) onDone?.();
  }, [queue.length, onDone]);

  const current = queue[0];

  if (!current) return null;

  const advance = (extraItems: QueueItem[] = []) => {
    setQueue((prev) => [...extraItems, ...prev.slice(1)]);
    setAnimating(false);
  };

  const withAnimation = (fn: () => void) => {
    if (animating) return;
    setAnimating(true);
    setTimeout(() => { fn(); }, 180);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSingle = (item: SinglePrompt, cooked: boolean) => {
    withAnimation(() => {
      if (item.source === "planner") {
        confirmSlot(item.date, cooked);
      } else {
        // Telemetry-only: if confirmed, insert into history
        if (cooked) {
          insertHistorySlot(item.date, item.recipeId);
        }
        clearPendingCookFlag(item.recipeId, item.date);
      }
      advance();
    });
  };

  const handleDualA = (item: DualPromptA, cookedPlanned: boolean) => {
    withAnimation(() => {
      if (cookedPlanned) {
        confirmSlot(item.date, true);
        clearPendingCookFlag(item.telemetryRecipeId, item.date);
        advance();
      } else {
        // Mark planned slot skipped, then ask about telemetry recipe
        confirmSlot(item.date, false);
        advance([{ kind: "dual-b", date: item.date, telemetryRecipeId: item.telemetryRecipeId }]);
      }
    });
  };

  const handleDualB = (item: DualPromptB, cookedTelemetry: boolean) => {
    withAnimation(() => {
      if (cookedTelemetry) {
        insertHistorySlot(item.date, item.telemetryRecipeId);
      }
      clearPendingCookFlag(item.telemetryRecipeId, item.date);
      advance();
    });
  };

  // ── Resolve recipe objects for display ────────────────────────────────────

  const findRecipe = (id: string): Recipe | null =>
    recipes.find((r) => r.id === id) ?? null;

  const primaryRecipeId =
    current.kind === "single" ? current.recipeId
    : current.kind === "dual-a" ? current.plannedRecipeId
    : current.telemetryRecipeId;

  const primaryRecipe = findRecipe(primaryRecipeId);

  const question =
    current.kind === "dual-b"
      ? `Did you cook this instead?`
      : `Did you cook this?`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
      <div
        className={`w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden
          transition-all duration-200 ${animating ? "scale-95 opacity-0" : "scale-100 opacity-100"}`}
      >
        {/* Image */}
        <div className="relative h-44 bg-orange-50 flex items-center justify-center overflow-hidden">
          {primaryRecipe?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={primaryRecipe.imageUrl}
              alt={primaryRecipe.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-6xl select-none">🍽️</span>
          )}
          {queue.length > 1 && (
            <span className="absolute top-3 right-3 bg-black/60 text-white text-xs font-bold px-2 py-1 rounded-full">
              {queue.length} remaining
            </span>
          )}
        </div>

        <div className="px-6 py-5">
          <p className="text-xs font-semibold text-orange-500 uppercase tracking-wider mb-1">
            {formatDate(current.date)}
          </p>
          <h2 className="text-xl font-bold text-gray-900 mb-1 leading-tight">
            {question}
          </h2>
          {primaryRecipe ? (
            <p className="text-sm text-gray-500 mb-6 line-clamp-2">{primaryRecipe.title}</p>
          ) : (
            <p className="text-sm text-gray-400 italic mb-6">Recipe no longer in library</p>
          )}

          <div className="flex flex-col gap-3">
            <button
              onClick={() => {
                if (current.kind === "single") handleSingle(current, true);
                else if (current.kind === "dual-a") handleDualA(current, true);
                else handleDualB(current, true);
              }}
              className="w-full py-3.5 rounded-2xl bg-orange-500 text-white font-bold text-sm
                         shadow-sm hover:bg-orange-600 active:scale-95 transition-all"
            >
              ✓ Yes, I made it!
            </button>
            <button
              onClick={() => {
                if (current.kind === "single") handleSingle(current, false);
                else if (current.kind === "dual-a") handleDualA(current, false);
                else handleDualB(current, false);
              }}
              className="w-full py-3 rounded-2xl border border-gray-200 text-gray-600 font-semibold
                         text-sm hover:bg-gray-50 active:scale-95 transition-all"
            >
              {current.kind === "dual-b" ? "No, not this one either" : "No, I skipped it"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}