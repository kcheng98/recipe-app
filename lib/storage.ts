import { defaultAppData } from "./defaults";
import type { AppData } from "./types";

const STORAGE_KEY = "recipe-app-data-v1";

export function loadAppData(): AppData {
  if (typeof window === "undefined") {
    return defaultAppData;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppData;
    const parsed = { ...defaultAppData, ...JSON.parse(raw) } as AppData;
    parsed.folders = parsed.folders.map((folder, index) => ({
      ...folder,
      order: typeof folder.order === "number" ? folder.order : index,
    }));
    parsed.folders.sort((a, b) => a.order - b.order);
    return parsed;
  } catch {
    return defaultAppData;
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
