import Link from "next/link";
import RecipeImage from "@/components/RecipeImage";
import type { Label, Recipe } from "@/lib/types";

type RecipeCardProps = {
  recipe: Recipe;
  labels: Label[];
};

// Map values to display text/emojis matching your customized verbiage rules
const PROTEIN_LABELS: Record<string, string> = {
  poultry: "🍗 Poultry",
  "fish-seafood": "🐟 Fish / Seafood",
  "red-meat": "🥩 Red Meat",
  vegetarian: "🌱 Veg / Vegan",
};

const VIBE_LABELS: Record<string, string> = {
  "light-fresh": "🌿 Light & Fresh",
  "all-weather": "☁️ All-Weather",
  "heavy-rich": "🍲 Heavy & Rich",
};

export default function RecipeCard({ recipe, labels }: RecipeCardProps) {
  const recipeLabels = labels.filter((l) => recipe.labelIds.includes(l.id));

  return (
    <Link href={`/recipes/${recipe.id}`} className="block">
      <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e5e5ea] transition hover:shadow-md">
        <div className="relative aspect-[4/3] overflow-hidden bg-[#f5f5f7]">
          {recipe.imageUrl ? (
            <RecipeImage
              src={recipe.imageUrl}
              alt={recipe.title}
              fill
              className="transition duration-300 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-4xl text-[#c7c7cc]">
              🍽️
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-[17px] font-semibold leading-snug text-[#1d1d1f]">
              {recipe.title}
            </h3>
            {recipe.totalTime ? (
              <span className="shrink-0 text-xs text-[#86868b]">
                ⏱ {recipe.totalTime}
              </span>
            ) : null}
          </div>
          
          {/* Display section for combined System & Custom badges */}
          {(recipe.proteinType || recipe.vibe || recipeLabels.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {/* 1. Protein Type Pillar Label */}
              {recipe.proteinType && PROTEIN_LABELS[recipe.proteinType] && (
                <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600 ring-1 ring-orange-500/10">
                  {PROTEIN_LABELS[recipe.proteinType]}
                </span>
              )}

              {/* 2. Mood/Seasonal Vibe Pillar Label */}
              {recipe.vibe && VIBE_LABELS[recipe.vibe] && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 ring-1 ring-blue-500/10">
                  {VIBE_LABELS[recipe.vibe]}
                </span>
              )}

              {/* 3. User-Defined Custom Labels */}
              {recipeLabels.map((label) => (
                <span
                  key={label.id}
                  className="rounded-full bg-[#f5f5f7] px-2.5 py-0.5 text-xs font-medium text-[#515154]"
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}