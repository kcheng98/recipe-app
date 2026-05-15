import type { AppData, Recipe } from "./types";

export const ALL_FOLDER_ID = "all";

export const defaultFolders = [
  { id: "favorites", label: "Favorites", icon: "❤️", order: 0 },
  { id: "weeknight", label: "Weeknight Dinners", icon: "🌙", order: 1 },
  { id: "weekend", label: "Weekend Projects", icon: "☀️", order: 2 },
  { id: "baking", label: "Baking", icon: "🥐", order: 3 },
  { id: "meal-prep", label: "Meal Prep", icon: "🥡", order: 4 },
];

const now = new Date().toISOString();

export const defaultRecipes: Recipe[] = [
  {
    id: "1",
    title: "Lemon Ricotta Pancakes",
    description: "Fluffy pancakes with bright lemon and creamy ricotta.",
    imageUrl:
      "https://images.unsplash.com/photo-1528207776546-365bb710ee93?w=800&q=80",
    cookTime: "25 min",
    servings: "4",
    ingredients:
      "1 cup flour\n1 cup ricotta\n2 eggs\nZest of 1 lemon\n2 tbsp sugar\nPinch of salt",
    instructions:
      "Whisk dry ingredients.\nFold in ricotta, eggs, and lemon zest.\nCook on a buttered griddle until golden.",
    labelIds: [],
    folderId: "weekend",
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "2",
    title: "Sheet Pan Chicken & Veggies",
    description: "One-pan dinner with herbs, lemon, and roasted vegetables.",
    imageUrl:
      "https://images.unsplash.com/photo-1598103442097-9b6c6459ba05?w=800&q=80",
    cookTime: "40 min",
    servings: "4",
    ingredients:
      "4 chicken thighs\n2 cups mixed vegetables\n2 tbsp olive oil\n1 lemon\nSalt and pepper",
    instructions:
      "Preheat oven to 425°F.\nToss vegetables with oil and seasonings.\nRoast chicken and vegetables for 35–40 minutes.",
    labelIds: [],
    folderId: "weeknight",
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "3",
    title: "Creamy Tomato Basil Pasta",
    description: "Comforting pasta with a silky tomato cream sauce.",
    imageUrl:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=800&q=80",
    cookTime: "30 min",
    servings: "2",
    ingredients:
      "8 oz pasta\n1 can crushed tomatoes\n1/2 cup cream\nFresh basil\nGarlic",
    instructions:
      "Cook pasta until al dente.\nSimmer tomatoes with garlic.\nStir in cream and toss with pasta and basil.",
    labelIds: [],
    folderId: "weeknight",
    sourceType: "manual",
    createdAt: now,
    updatedAt: now,
  },
];

export const defaultAppData: AppData = {
  recipes: defaultRecipes,
  labels: [],
  folders: defaultFolders,
};
