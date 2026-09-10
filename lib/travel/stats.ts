import type { Trip } from "./types";

/** Today as an ISO "YYYY-MM-DD" — used both as a stat cutoff and as a form default. */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function daysBetween(startISO: string, endISO: string): number {
  const start = new Date(`${startISO}T00:00:00`);
  const end = new Date(`${endISO}T00:00:00`);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

export function isInProgress(trip: Trip): boolean {
  return trip.arrivalDate === null;
}

/**
 * Days away for this trip — from departure to arrival, or from departure to
 * today if it's still in progress (the user chose to have in-progress trips
 * count live toward the running total rather than only once completed).
 */
export function tripDays(trip: Trip, now: Date = new Date()): number {
  const end = trip.arrivalDate ?? todayISO(now);
  return daysBetween(trip.departureDate, end);
}

function yearOf(dateISO: string): string {
  return dateISO.slice(0, 4);
}

export type YearlyTravelStats = {
  daysAbroad: number;
  internationalTripCount: number;
  domesticTripCount: number;
  domesticDays: number;
};

/** All stats scoped to trips whose departure falls in `year` (e.g. "2026"). */
export function yearlyStats(trips: Trip[], year: string, now: Date = new Date()): YearlyTravelStats {
  const inYear = trips.filter((t) => yearOf(t.departureDate) === year);
  const international = inYear.filter((t) => t.type === "international");
  const domestic = inYear.filter((t) => t.type === "domestic");

  return {
    daysAbroad: international.reduce((sum, t) => sum + tripDays(t, now), 0),
    internationalTripCount: international.length,
    domesticTripCount: domestic.length,
    domesticDays: domestic.reduce((sum, t) => sum + tripDays(t, now), 0),
  };
}

/** The trip currently in progress, if any — furthest-departed one wins if somehow more than one. */
export function currentTrip(trips: Trip[]): Trip | null {
  const inProgress = trips.filter(isInProgress);
  if (inProgress.length === 0) return null;
  return inProgress.reduce((latest, t) => (t.departureDate > latest.departureDate ? t : latest));
}

/** "Aug 9" for a single date. */
export function formatDate(dateISO: string): string {
  const d = new Date(`${dateISO}T00:00:00`);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "Aug 9–12" within one month, "Aug 30–Sep 2" across a month boundary, "Aug 30–?" if still open. */
export function formatDateRange(startISO: string, endISO: string | null): string {
  if (!endISO) return `${formatDate(startISO)}–?`;
  const s = new Date(`${startISO}T00:00:00`);
  const e = new Date(`${endISO}T00:00:00`);
  const monthOf = (d: Date) => d.toLocaleDateString("en-US", { month: "short" });
  const start = formatDate(startISO);
  const end = monthOf(s) === monthOf(e) ? `${e.getDate()}` : formatDate(endISO);
  return `${start}–${end}`;
}

/** Completed trips, newest departure first. */
export function pastTrips(trips: Trip[]): Trip[] {
  return trips
    .filter((t) => !isInProgress(t))
    .slice()
    .sort((a, b) => (a.departureDate < b.departureDate ? 1 : -1));
}
