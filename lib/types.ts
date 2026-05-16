export type SourceType = "manual" | "url" | "photo" | "pdf";

export type Recipe = {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  prepTime: string;
  cookTime: string;
  totalTime: string;
  yields: string;
  ingredients: string;
  instructions: string;
  labelIds: string[];
  folderId: string;
  sourceType: SourceType;
  sourceUrl?: string;
  createdAt: string;
  updatedAt: string;
};

export type Label = {
  id: string;
  name: string;
};

export type Folder = {
  id: string;
  label: string;
  icon: string;
  order: number;
};

export type AppData = {
  recipes: Recipe[];
  labels: Label[];
  folders: Folder[];
};

export type RecipeDraft = Omit<Recipe, "id" | "createdAt" | "updatedAt">;

export type ImportedRecipe = Partial<RecipeDraft> & {
  title?: string;
};
