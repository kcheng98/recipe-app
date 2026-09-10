import type { TravelData } from "./types";

const STORAGE_KEY = "travel-data-v1";

const EMPTY_DATA: TravelData = { trips: [] };

export function loadTravelData(): TravelData {
  if (typeof window === "undefined") return EMPTY_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw) as Partial<TravelData>;
    return { trips: parsed.trips ?? [] };
  } catch {
    return EMPTY_DATA;
  }
}

export function saveTravelData(data: TravelData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota) — not worth surfacing.
  }
}
