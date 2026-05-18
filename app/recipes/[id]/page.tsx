"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import RecipeImage from "@/components/RecipeImage";
import { useApp } from "@/context/AppProvider";
import { cleanRecipeLine } from "@/lib/cleanRecipeText";
import { useWakeLock } from "@/hooks/useWakeLock";

function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => cleanRecipeLine(line))
    .filter(Boolean);
}

export default function CookModePage() {
  const params = useParams();
  const id = params.id as string;
  const { ready, recipes, labels } = useApp();
  const recipe = recipes.find((r) => r.id === id);

  useWakeLock(true);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-[#86868b]">
        Loading…
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4">
        <p className="text-lg text-[#1d1d1f]">Recipe not found</p>
        <Link href="/" className="text-[#0071e3]">
          Back home
        </Link>
      </div>
    );
  }

  const recipeLabels = labels.filter((l) => recipe.labelIds.includes(l.id));
  const ingredients = splitLines(recipe.ingredients);
  const steps = splitLines(recipe.instructions);

  return (
    <div className="min-h-screen bg-white pb-24 text-[#1d1d1f]">
      <header className="sticky top-0 z-20 border-b border-[#e5e5ea] bg-white/95 px-4 py-3 backdrop-blur-md">
        <Link href="/" className="text-sm text-[#0071e3]">
          ← Recipes
        </Link>
      </header>

      {recipe.imageUrl ? (
        <div className="relative w-full bg-[#f5f5f7] aspect-[16/10] md:aspect-[32/10]">
        <RecipeImage src={recipe.imageUrl} alt={recipe.title} fill />
        </div>
      ) : null}

      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          {recipe.title}
        </h1>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-[#86868b]">
          {recipe.prepTime ? (
            <span><span className="font-medium uppercase tracking-wide text-xs text-[#515154]">Prep Time:</span> {recipe.prepTime}</span>
          ) : null}
          {recipe.cookTime ? (
            <span><span className="font-medium uppercase tracking-wide text-xs text-[#515154]">Cook Time:</span> {recipe.cookTime}</span>
          ) : null}
          {recipe.totalTime ? (
            <span><span className="font-medium uppercase tracking-wide text-xs text-[#515154]">Total Time:</span> {recipe.totalTime}</span>
          ) : null}
          {recipe.yields ? (
            <span><span className="font-medium uppercase tracking-wide text-xs text-[#515154]">Yield:</span> {recipe.yields}</span>
          ) : null}
        </div>

        {/* System Pillars & Custom Labels prioritized block */}
        {(recipe.proteinType || recipe.vibe || recipeLabels.length > 0) ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {/* 1. Protein Type Pillar Badge */}
            {recipe.proteinType && recipe.proteinType !== "none" && (
              <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-600 ring-1 ring-orange-500/10">
                {recipe.proteinType === "poultry" ? "🍗 Poultry" :
                 recipe.proteinType === "fish-seafood" ? "🐟 Fish / Seafood" :
                 recipe.proteinType === "red-meat" ? "🥩 Red Meat" :
                 recipe.proteinType === "vegetarian" ? "🌱 Veg / Vegan" :
                 recipe.proteinType === "vegan" ? "🌱 Veg / Vegan" : null}
              </span>
            )}

            {/* 2. Mood/Seasonal Vibe Pillar Badge */}
            {recipe.vibe && (
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600 ring-1 ring-blue-500/10">
                {recipe.vibe === "light-fresh" ? "🌿 Light & Fresh" :
                 recipe.vibe === "all-weather" ? "☁️ All-Weather" : "🍲 Heavy & Rich"}
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
        ) : null}

        <section className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Ingredients</h2>
          <ul className="space-y-3 text-[17px] leading-relaxed">
            {ingredients.map((item) => (
              item.endsWith(":") ? (
                <li key={item} className="pt-2 text-sm font-semibold uppercase tracking-wide text-[#515154]">
                  {item}
                </li>
              ) : (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-[#0071e3]" />
                  <span>{item}</span>
                </li>
              )
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="mb-4 text-xl font-semibold">Instructions</h2>
          <ol className="space-y-5">
            {(() => {
              let stepNumber = 0;
              return steps.map((step, index) => {
                if (step.endsWith(":")) {
                  return (
                    <li key={`${index}-${step.slice(0, 24)}`} className="pt-2 text-sm font-semibold uppercase tracking-wide text-[#515154]">
                      {step}
                    </li>
                  );
                }
                stepNumber++;
                return (
                  <li key={`${index}-${step.slice(0, 24)}`} className="flex gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1d1d1f] text-sm font-semibold text-white">
                      {stepNumber}
                    </span>
                    <p className="pt-0.5 text-[17px] leading-relaxed">{step}</p>
                  </li>
                );
              });
            })()}
          </ol>
        </section>

        {recipe.notes ? (
          <section className="mt-10">
            <h2 className="mb-4 text-xl font-semibold">Notes</h2>
            <div className="rounded-2xl bg-[#f5f5f7] px-5 py-4 text-[17px] leading-relaxed text-[#515154] whitespace-pre-wrap">
              {recipe.notes}
            </div>
          </section>
        ) : null}

        {(recipe.author || recipe.recipeSite || recipe.sourceUrl) ? (
          <section className="mt-10 border-t border-[#e5e5ea] pt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-[#86868b]">Source</p>
            <div className="mt-2 space-y-1 text-sm text-[#515154]">
              {recipe.author ? <p>Author: {recipe.author}</p> : null}
              {recipe.recipeSite ? <p>Site: {recipe.recipeSite}</p> : null}
              {recipe.sourceUrl ? (
                <p>
                  URL:{" "}
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#0071e3] underline-offset-2 hover:underline"
                  >
                    {recipe.sourceUrl}
                  </a>
                </p>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e5e5ea] bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-2xl justify-center">
          <Link
            href={`/recipes/${recipe.id}/edit`}
            className="text-sm text-[#86868b] underline-offset-2 hover:text-[#515154] hover:underline"
          >
            Edit recipe
          </Link>
        </div>
      </footer>
    </div>
  );
}