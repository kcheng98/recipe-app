/**
 * lib/planner/weather.ts
 *
 * Returns a MoodVibe based on the current month, calibrated for Seattle:
 *
 *   Nov – Mar  →  "heavy-rich"   (cold, grey, comfort-food season)
 *   Apr – May  →  "all-weather"  (transition spring — either works)
 *   Jun – Aug  →  "light-fresh"  (warm, peak summer produce)
 *   Sep – Oct  →  "all-weather"  (transition autumn — either works)
 *
 * Used by Stage 1 of the algorithm to hard-filter recipes whose vibe is
 * the wrong season. "all-weather" recipes always pass regardless of season.
 */

import type { MoodVibe } from "@/lib/types";

/** 0-indexed month number → seasonal vibe for Seattle */
const SEATTLE_VIBES: Record<number, MoodVibe> = {
  0: "heavy-rich",   // January
  1: "heavy-rich",   // February
  2: "heavy-rich",   // March
  3: "all-weather",  // April
  4: "all-weather",  // May
  5: "light-fresh",  // June
  6: "light-fresh",  // July
  7: "light-fresh",  // August
  8: "all-weather",  // September
  9: "all-weather",  // October
  10: "heavy-rich",  // November
  11: "heavy-rich",  // December
};

/**
 * Returns the current seasonal vibe for Seattle based on the current month.
 * This is intentionally simple — no API call, no location permission needed.
 */
export function getSeasonalVibe(): MoodVibe {
  const month = new Date().getMonth(); // 0 = January
  return SEATTLE_VIBES[month] ?? "all-weather";
}
