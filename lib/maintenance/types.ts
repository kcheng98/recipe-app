// ─── Home Maintenance types ─────────────────────────────────────────────────

/**
 * One logged occurrence of doing a maintenance item. `id` isn't in the
 * original spec's shape but is required to target a specific row for the
 * hover edit/delete affordance on the item-detail history list — without a
 * stable id, editing/deleting a row would have to key off (date, note),
 * which breaks the moment two entries share a date.
 */
export type MaintenanceHistoryEntry = {
  id: string;
  /** ISO date string, e.g. "2026-05-19" — never a future date. */
  date: string;
  note?: string;
};

export type MaintenanceItem = {
  id: string;
  name: string;
  /** Free text, no fixed enum — autocomplete is driven off past entries. */
  category?: string;
  /** null = "as needed" — no schedule, never shows as overdue/due-soon. */
  intervalDays: number | null;
  /** null = never logged yet. Always derived from `history` — see status.ts's recalculateLastDone. */
  lastDoneDate: string | null;
  /** Newest-first is a display concern, not a storage concern — kept in insertion order here. */
  history: MaintenanceHistoryEntry[];
  notes?: string;
};

export type MaintenanceData = {
  items: MaintenanceItem[];
};

export type MaintenanceItemDraft = {
  name: string;
  category?: string;
  intervalDays: number | null;
  /** Optional backdated "last done on" date supplied at creation time. */
  lastDoneDate?: string | null;
  notes?: string;
};
