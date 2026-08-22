import type { MaintenanceHistoryEntry, MaintenanceItem } from "./types";

export type MaintenanceStatus =
  | "overdue"
  | "due-soon"
  | "on-track"
  | "not-logged"
  | "as-needed";

/** ISO date string for today at midnight local time, e.g. "2026-08-22" — matches the convention already used in AppProvider/RecipeCard. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysBetween(fromISO: string, toISO: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((new Date(toISO).getTime() - new Date(fromISO).getTime()) / msPerDay);
}

/**
 * Due-soon window: whichever is smaller of 7 days or 20% of the interval,
 * floored at 2 days — so a 90-day filter change gets a ~7-day heads up, but
 * a 3-day "water the seedlings" item doesn't spend its entire life "due soon".
 */
function dueSoonWindow(intervalDays: number): number {
  return Math.max(2, Math.min(7, Math.round(intervalDays * 0.2)));
}

export function computeStatus(item: MaintenanceItem, today: string = todayISO()): MaintenanceStatus {
  if (item.intervalDays === null) return "as-needed";
  if (!item.lastDoneDate) return "not-logged";

  const dueDate = addDays(item.lastDoneDate, item.intervalDays);
  const daysUntilDue = daysBetween(today, dueDate);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= dueSoonWindow(item.intervalDays)) return "due-soon";
  return "on-track";
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Human label + days-until/overdue count, for the dashboard row and detail summary. */
export function statusLabel(item: MaintenanceItem, today: string = todayISO()): string {
  const status = computeStatus(item, today);
  if (status === "as-needed") return "as needed";
  if (status === "not-logged") return "not yet logged";

  const dueDate = addDays(item.lastDoneDate!, item.intervalDays!);
  const daysUntilDue = daysBetween(today, dueDate);

  if (status === "overdue") return `${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} overdue`;
  if (daysUntilDue === 0) return "due today";
  return `due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`;
}

const STATUS_RANK: Record<MaintenanceStatus, number> = {
  overdue: 0,
  "due-soon": 1,
  "on-track": 2,
  "not-logged": 3,
  "as-needed": 4,
};

/** Overdue → due soon → on track → not-yet-logged → as-needed, per the dashboard spec. */
export function sortByUrgency(items: MaintenanceItem[], today: string = todayISO()): MaintenanceItem[] {
  return [...items].sort((a, b) => {
    const rankDiff = STATUS_RANK[computeStatus(a, today)] - STATUS_RANK[computeStatus(b, today)];
    if (rankDiff !== 0) return rankDiff;
    // Within the same status, most urgent/most-recently-relevant first.
    const aDue = a.intervalDays !== null && a.lastDoneDate ? addDays(a.lastDoneDate, a.intervalDays) : "";
    const bDue = b.intervalDays !== null && b.lastDoneDate ? addDays(b.lastDoneDate, b.intervalDays) : "";
    if (aDue && bDue) return aDue < bDue ? -1 : aDue > bDue ? 1 : 0;
    return a.name.localeCompare(b.name);
  });
}

export function summarizeCounts(items: MaintenanceItem[], today: string = todayISO()) {
  const counts = { overdue: 0, dueSoon: 0, onTrack: 0 };
  for (const item of items) {
    const status = computeStatus(item, today);
    if (status === "overdue") counts.overdue += 1;
    else if (status === "due-soon") counts.dueSoon += 1;
    else if (status === "on-track") counts.onTrack += 1;
  }
  return counts;
}

/**
 * Recomputes lastDoneDate from the history array — the single source of
 * truth. Called after every history mutation (mark done, edit a date,
 * delete an entry) so lastDoneDate can never drift from what the log
 * actually says. Newest date wins; ties broken arbitrarily (same date is
 * the same day either way).
 */
export function recalculateLastDone(history: MaintenanceHistoryEntry[]): string | null {
  if (history.length === 0) return null;
  return history.reduce((latest, entry) => (entry.date > latest ? entry.date : latest), history[0].date);
}
