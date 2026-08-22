"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import RecipeForm from "@/components/RecipeForm";
import { useApp } from "@/context/AppProvider";
import type { RecipeDraft } from "@/lib/types";

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const { recipes, updateRecipeById, deleteRecipe, ready } = useApp();
  const id = params.id as string;

  const recipe = recipes.find((r) => r.id === id);

  const [draft, setDraft] = useState<RecipeDraft | null>(null);

  // Initialize draft exactly once when data is ready — never re-derived from
  // live context so Supabase realtime updates can't wipe in-progress edits.
  useEffect(() => {
    if (ready && recipe && draft === null) {
      const { id: _id, createdAt, updatedAt, ...nextDraft } = recipe;
      setDraft(nextDraft);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading…
      </div>
    );
  }

  if (!recipe || !draft) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
        <p className="text-lg text-[#1d1d1f]">Recipe not found</p>
        <Link href="/recipe" className="text-[#0071e3] hover:underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7]">
      <header className="border-b border-[#e5e5ea] bg-white/90 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
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
              Edit recipe
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                if (!draft.title.trim()) return;
                updateRecipeById(id, {
                  ...draft,
                  title: draft.title.trim(),
                  description: draft.description.trim() || draft.title.trim(),
                });
                // router.back(), not push — we always arrive at Edit from the
                // recipe detail page, so going back lands exactly there (with
                // the fresh data, since the page renders from live app state)
                // without adding a new history entry. Pushing here was what
                // made "← Recipes" take several clicks to reach home.
                router.back();
              }}
              className="shrink-0 rounded-xl bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0077ed]"
            >
              Save changes
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="shrink-0 rounded-xl bg-white px-4 py-2 text-sm font-medium text-[#1d1d1f] ring-1 ring-[#e5e5ea] hover:bg-[#f5f5f7]"
            >
              Cancel
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-8 sm:px-6">
        <RecipeForm
          draft={draft}
          onChange={setDraft}
          submitLabel="Save changes"
          onSubmit={() => {
            if (!draft.title.trim()) return;
            updateRecipeById(id, {
              ...draft,
              title: draft.title.trim(),
              description: draft.description.trim() || draft.title.trim(),
            });
            router.back();
          }}
          onCancel={() => router.back()}
        />

        <div className="mx-auto max-w-3xl pb-8">
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this recipe permanently?")) {
                deleteRecipe(id);
                router.push("/recipe");
              }
            }}
            className="mt-4 w-full rounded-xl px-4 py-3 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-50"
          >
            Delete recipe
          </button>
        </div>
      </main>
    </div>
  );
}