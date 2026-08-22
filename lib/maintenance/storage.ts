import type { MaintenanceData } from "./types";

const STORAGE_KEY = "maintenance-data-v1";

const EMPTY_DATA: MaintenanceData = { items: [] };

export function loadMaintenanceData(): MaintenanceData {
  if (typeof window === "undefined") return EMPTY_DATA;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DATA;
    const parsed = JSON.parse(raw) as Partial<MaintenanceData>;
    return { items: parsed.items ?? [] };
  } catch {
    return EMPTY_DATA;
  }
}

export function saveMaintenanceData(data: MaintenanceData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage unavailable (private browsing, quota) — not worth surfacing.
  }
}
