"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import RecipeForm from "@/components/RecipeForm";
import { useApp } from "@/context/AppProvider";
import type { RecipeDraft } from "@/lib/types";

export default function EditRecipePage() {
  const params = useParams();
  const router = useRouter();
  const { recipes, updateRecipeById, deleteRecipe, ready } = useApp();
  const id = params.id as string;

  const recipe = recipes.find((r) => r.id === id);

  const initialDraft = useMemo<RecipeDraft | null>(() => {
    if (!recipe) return null;
    const { id: _id, createdAt, updatedAt, ...draft } = recipe;
    return draft;
  }, [recipe]);

  const [draft, setDraft] = useState<RecipeDraft | null>(initialDraft);

  useEffect(() => {
    if (recipe) {
      const { id: _id, createdAt, updatedAt, ...nextDraft } = recipe;
      setDraft(nextDraft);
    }
  }, [recipe]);

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
        <Link href="/" className="text-[#0071e3] hover:underline">
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
            <Link href="/" className="text-sm text-[#0071e3] hover:underline">
              ← Back to recipes
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-[#1d1d1f]">
              Edit recipe
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              if (confirm("Delete this recipe permanently?")) {
                deleteRecipe(id);
                router.push("/");
              }
            }}
            className="shrink-0 rounded-xl px-4 py-2 text-sm text-red-600 ring-1 ring-red-200 hover:bg-red-50"
          >
            Delete
          </button>
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
            router.push(`/recipes/${id}`);
          }}
          onCancel={() => router.push(`/recipes/${id}`)}
        />
      </main>
    </div>
  );
}
