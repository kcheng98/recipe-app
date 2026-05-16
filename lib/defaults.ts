import type { AppData } from "./types";

export const ALL_FOLDER_ID = "all";

export const defaultFolders = [
  { id: "favorites", label: "Favorites", icon: "❤️", order: 0 },
  { id: "weeknight", label: "Weeknight Dinners", icon: "🌙", order: 1 },
  { id: "weekend", label: "Weekend Projects", icon: "☀️", order: 2 },
  { id: "baking", label: "Baking", icon: "🥐", order: 3 },
  { id: "meal-prep", label: "Meal Prep", icon: "🥡", order: 4 },
];

export const defaultAppData: AppData = {
  recipes: [],
  labels: [],
  folders: defaultFolders,
};