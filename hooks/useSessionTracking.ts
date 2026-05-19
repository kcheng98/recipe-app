/**
 * hooks/useSessionTracking.ts
 *
 * Ambient cook detection for the recipe detail / cook page.
 *
 * Logic:
 *   - Timer starts on mount.
 *   - If the page stays open > 4 minutes AND scroll activity is detected
 *     → write a `pending-cook` flag to localStorage for that recipe + date.
 *   - If 20 minutes pass with no scroll activity → abort and clear the flag
 *     (idle false-positive protection).
 *   - Cleans up all listeners and timers on unmount.
 *
 * Consumers (CookConfirmIntercept) read `pending-cook:*` keys from
 * localStorage via the exported `getPendingCookFlags` helper.
 */

import { useEffect, useRef } from "react";

const ENGAGE_MS = 4 * 60 * 1000;   // 4 minutes — minimum engaged time
const IDLE_MS   = 20 * 60 * 1000;  // 20 minutes of no scroll → abort

export type PendingCookFlag = {
  recipeId: string;
  date: string; // ISO YYYY-MM-DD — the date the session occurred
};

function flagKey(recipeId: string, date: string): string {
  return `pending-cook:${recipeId}:${date}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Read all pending-cook flags from localStorage. */
export function getPendingCookFlags(): PendingCookFlag[] {
  if (typeof window === "undefined") return [];
  const flags: PendingCookFlag[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("pending-cook:")) continue;
    const [, recipeId, date] = key.split(":");
    if (recipeId && date) flags.push({ recipeId, date });
  }
  // Oldest date first (FIFO)
  return flags.sort((a, b) => a.date.localeCompare(b.date));
}

/** Remove a specific flag once it has been confirmed or dismissed. */
export function clearPendingCookFlag(recipeId: string, date: string): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(flagKey(recipeId, date));
}

/**
 * Call this hook on the recipe detail / cook page.
 * Pass the recipe's ID; the hook handles everything else.
 */
export function useSessionTracking(recipeId: string | null | undefined): void {
  const scrolledRef  = useRef(false);
  const flagWritten  = useRef(false);
  const engageTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!recipeId) return;

    const date = todayISO();

    const clearTimers = () => {
      if (engageTimer.current) clearTimeout(engageTimer.current);
      if (idleTimer.current)   clearTimeout(idleTimer.current);
    };

    const writeFlag = () => {
      if (flagWritten.current) return;
      if (!scrolledRef.current) return; // must have scrolled
      flagWritten.current = true;
      localStorage.setItem(flagKey(recipeId, date), "1");
    };

    const resetIdleTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        // 20 mins idle — abort and clear any flag written this session
        clearTimers();
        if (flagWritten.current) {
          localStorage.removeItem(flagKey(recipeId, date));
          flagWritten.current = false;
        }
      }, IDLE_MS);
    };

    const handleScroll = () => {
      scrolledRef.current = true;
      resetIdleTimer();
    };

    // Start the 4-minute engagement timer
    engageTimer.current = setTimeout(() => {
      writeFlag();
    }, ENGAGE_MS);

    // Start the idle timer immediately (resets on every scroll)
    resetIdleTimer();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      clearTimers();
      window.removeEventListener("scroll", handleScroll);
    };
  }, [recipeId]);
}