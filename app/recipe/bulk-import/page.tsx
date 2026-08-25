"use client";

/**
 * ONE-TIME bulk import page.
 *
 * Not linked from anywhere in the app's nav — reachable only by typing the
 * URL directly. Loads /public/bulk-import-data.json (22 recipes transcribed
 * from Kenzi's personal recipe book, each with title/author/time/servings/
 * ingredients/instructions/photo already filled in) and calls the same
 * addRecipe() used by the normal "Add recipe" flow, once per recipe — so
 * every write goes through the existing sync + conflict-guard machinery,
 * nothing bypasses it.
 *
 * This route (and public/bulk-import-data.json) should be deleted once the
 * import is confirmed to have worked.
 */

import { useState } from "react";
import { useApp } from "@/context/AppProvider";
import { draftFromImport } from "@/lib/recipeUtils";
import type { ImportedRecipe } from "@/lib/types";

type BulkRecipe = {
  slug: string;
  folderId: string;
  title: string;
  author: string;
  cookTime: string;
  yields: string;
  ingredients: string;
  instructions: string;
  notes: string;
  imageUrl: string;
};

type RowStatus = "pending" | "importing" | "done" | "error";

export default function BulkImportPage() {
  const { ready, user, addRecipe, folders } = useApp();
  const [rows, setRows] = useState<Record<string, RowStatus>>({});
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [loadError, setLoadError] = useState("");

  async function runImport() {
    setRunning(true);
    setFinished(false);
    setLoadError("");

    try {
      const res = await fetch("/bulk-import-data.json");
      if (!res.ok) throw new Error(`Could not load bulk-import-data.json (${res.status})`);
      const recipes: BulkRecipe[] = await res.json();

      const initial: Record<string, RowStatus> = {};
      recipes.forEach((r) => (initial[r.slug] = "pending"));
      setRows(initial);

      const knownFolderIds = new Set(folders.map((f) => f.id));

      for (const r of recipes) {
        setRows((prev) => ({ ...prev, [r.slug]: "importing" }));
        try {
          // If this account's folder IDs ever differ from weeknight/weekend/
          // baking (e.g. re-created from scratch), fall back to the first
          // folder rather than writing to a folder id that doesn't exist.
          const folderId = knownFolderIds.has(r.folderId)
            ? r.folderId
            : folders[0]?.id ?? r.folderId;

          const partial: ImportedRecipe = {
            title: r.title,
            author: r.author,
            cookTime: r.cookTime,
            yields: r.yields,
            ingredients: r.ingredients,
            instructions: r.instructions,
            notes: r.notes,
            imageUrl: r.imageUrl,
            description: r.title,
          };

          const draft = draftFromImport(partial, folderId, "manual");
          addRecipe(draft);
          setRows((prev) => ({ ...prev, [r.slug]: "done" }));
        } catch (err) {
          console.error(`Failed to import ${r.title}`, err);
          setRows((prev) => ({ ...prev, [r.slug]: "error" }));
        }
        // Small pause between writes so each one has a moment to sync
        // before the next fires, rather than firing all 22 in one tick.
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setRunning(false);
      setFinished(true);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center text-[#86868b]">
        Loading…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center text-[#86868b]">
        You need to be signed in to your Kitchen account for this import to save
        anywhere. Sign in, then reload this page.
      </div>
    );
  }

  const doneCount = Object.values(rows).filter((s) => s === "done").length;
  const errorCount = Object.values(rows).filter((s) => s === "error").length;
  const total = Object.keys(rows).length;

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-[#1d1d1f]">
          One-time recipe import
        </h1>
        <p className="mt-2 text-sm text-[#86868b]">
          Signed in as {user.email}. This imports 22 recipes from your recipe
          book into Mains / Sides / Baking. It uses the same save path as
          adding a recipe by hand, so it's safe to run — but it's meant to be
          run once.
        </p>

        {!running && !finished && (
          <button
            type="button"
            onClick={runImport}
            className="mt-6 rounded-xl bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0077ed]"
          >
            Import 22 recipes
          </button>
        )}

        {loadError && (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}

        {total > 0 && (
          <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-[#e5e5ea]">
            <p className="mb-3 text-sm font-medium text-[#1d1d1f]">
              {finished
                ? `Done — ${doneCount} of ${total} imported${errorCount ? `, ${errorCount} failed` : ""}.`
                : `Importing… ${doneCount} of ${total} so far`}
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              {Object.entries(rows).map(([slug, status]) => (
                <li key={slug} className="flex items-center justify-between">
                  <span className="text-[#1d1d1f]">{slug.replace(/-/g, " ")}</span>
                  <span
                    className={
                      status === "done"
                        ? "text-green-600"
                        : status === "error"
                          ? "text-red-600"
                          : status === "importing"
                            ? "text-[#0071e3]"
                            : "text-[#86868b]"
                    }
                  >
                    {status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {finished && (
          <p className="mt-6 text-sm text-[#86868b]">
            Go check your recipe library. Once everything looks right, let
            Claude know and this page (and the data file it loads) can be
            deleted from the repo.
          </p>
        )}
      </div>
    </div>
  );
}
