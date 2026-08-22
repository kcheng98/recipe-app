"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ImportMethods from "@/components/ImportMethods";
import RecipeForm from "@/components/RecipeForm";
import { useApp } from "@/context/AppProvider";
import { emptyDraft } from "@/lib/recipeUtils";
import type { RecipeDraft } from "@/lib/types";

export default function NewRecipePage() {
  const router = useRouter();
  const { folders, addRecipe, ready } = useApp();
  const [step, setStep] = useState<"import" | "edit">("import");
  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  const defaultFolderId = folders[0]?.id ?? "";

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading…
      </div>
    );
  }

  function handleSave() {
    if (!draft?.title.trim()) return;
    const recipe = addRecipe({
      ...draft,
      title: draft.title.trim(),
      description: draft.description.trim() || draft.title.trim(),
    });
    // router.replace(), not push — this page is a single history entry, so
    // replacing it with the new recipe's detail page means "← Recipes" goes
    // straight back to Home, instead of landing back on this Add-recipe
    // screen for a recipe that's already been saved.
    router.replace(`/recipes/${recipe.id}`);
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="border-b border-[#e5e5ea] bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
        <div>
            {/* router.back() (not a fixed href) so the home page's
                filters/scroll position are restored as left. */}
            <button
              type="button"
              onClick={() => router.back()}
              className="cursor-pointer text-sm text-[#0071e3] hover:underline"
            >
              ← Back to recipes
            </button>
            <h1 className="mt-1 text-2xl font-semibold text-[#1d1d1f]">
              Add recipe
            </h1>
          </div>
          {step === "edit" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                className="shrink-0 rounded-xl bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077ed]"
              >
                Save recipe
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#1d1d1f] ring-1 ring-[#e5e5ea] hover:bg-[#f5f5f7]"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {step === "import" ? (
          <ImportMethods
            folderId={defaultFolderId}
            onDraftReady={(d) => {
              setDraft(d);
              setStep("edit");
            }}
          />
        ) : (
          draft && (
            <RecipeForm
              draft={draft}
              onChange={setDraft}
              submitLabel="Save recipe"
              onSubmit={handleSave}
              onCancel={() => router.back()}
            />
          )
        )}
      </main>

      <footer className="mx-auto max-w-3xl px-4 pb-8 sm:px-6">
        <p className="rounded-xl bg-[#e8f2fc] px-4 py-3 text-xs text-[#515154]">
          Coming later: meal planning and grocery lists.
        </p>
      </footer>
    </div>
  );
}
