import Link from "next/link";
import RecipeImage from "@/components/RecipeImage";
import type { Label, Recipe } from "@/lib/types";

type RecipeCardProps = {
  recipe: Recipe;
  labels: Label[];
};

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

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastCookedLabel(recipe: Recipe): string | null {
  if (!recipe.lastCookedAt) return null;
  // Compare date strings directly to avoid timezone issues
  const cookedDate = recipe.lastCookedAt.slice(0, 10); // "2026-05-19"
  const today = todayISO();
  const yesterday = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();
  if (cookedDate === today) return "Last cooked: today";
  if (cookedDate === yesterday) return "Last cooked: yesterday";
  // For older dates, compute difference in calendar days
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.round((new Date(today).getTime() - new Date(cookedDate).getTime()) / msPerDay);
  return `Last cooked: ${days} days ago`;
}

export default function RecipeCard({ recipe, labels }: RecipeCardProps) {
  const recipeLabels = labels.filter((l) => recipe.labelIds.includes(l.id));
  const cookedLabel = lastCookedLabel(recipe);

  return (
    <Link href={`/recipes/${recipe.id}`} className="block">
      <article className="group overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#e5e5ea] transition hover:shadow-md">
      <div className="relative aspect-[3/2] overflow-hidden bg-[#f5f5f7]">
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
        <div className="p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <h3 className="text-[17px] font-semibold leading-snug text-[#1d1d1f]">
              {recipe.title}
            </h3>
            {recipe.totalTime ? (
              <span className="shrink-0 text-xs text-[#86868b]">
                ⏱ {recipe.totalTime}
              </span>
            ) : null}
          </div>

          {/* Last cooked line — only shown if recipe has planner history */}
          {cookedLabel && (
            <p className="text-xs text-[#86868b] mb-2">{cookedLabel}</p>
          )}

          {(recipe.proteinType || recipe.vibe || recipeLabels.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.proteinType && PROTEIN_LABELS[recipe.proteinType] && (
                <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600 ring-1 ring-orange-500/10">
                  {PROTEIN_LABELS[recipe.proteinType]}
                </span>
              )}
              {recipe.vibe && VIBE_LABELS[recipe.vibe] && (
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 ring-1 ring-blue-500/10">
                  {VIBE_LABELS[recipe.vibe]}
                </span>
              )}
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