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
 * Imports happen in 3 batches (one button click each) rather than one long
 * auto-loop — a smaller, visible chunk at a time, and each batch only
 * proceeds once you click it. Any recipe whose title already exists in the
 * library is skipped automatically, so it's safe to reload and re-run a
 * batch that didn't finish.
 *
 * This route (and public/bulk-import-data.json) should be deleted once the
 * import is confirmed to have worked.
 */

import { useEffect, useRef, useState } from "react";
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

type RowStatus = "pending" | "importing" | "done" | "error" | "skipped";

const BATCH_COUNT = 3;

function splitIntoBatches<T>(items: T[], batchCount: number): T[][] {
  const batches: T[][] = Array.from({ length: batchCount }, () => []);
  const perBatch = Math.ceil(items.length / batchCount);
  items.forEach((item, i) => {
    batches[Math.min(Math.floor(i / perBatch), batchCount - 1)].push(item);
  });
  return batches.filter((b) => b.length > 0);
}

export default function BulkImportPage() {
  const { ready, user, addRecipe, folders, recipes: existingRecipes, syncStatus } = useApp();
  const [allRecipes, setAllRecipes] = useState<BulkRecipe[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [rows, setRows] = useState<Record<string, RowStatus>>({});
  const [running, setRunning] = useState(false);
  const [batchesRun, setBatchesRun] = useState(0);

  // addRecipe fires an async, unqueued write to Supabase, guarded by a
  // version check. Firing the next addRecipe before the previous one's
  // write actually confirms races that version check — the second write
  // collides, the app resolves it as a "conflict" and pulls down the cloud
  // copy from *before* the burst, silently reverting local state and
  // dropping whatever was added in between. This is what ate Sides/Baking
  // last time. Waiting here for syncStatus to return to "synced" (not just
  // a fixed delay) after each recipe serializes the writes so each one is
  // actually confirmed before the next fires.
  const syncStatusRef = useRef(syncStatus);
  useEffect(() => {
    syncStatusRef.current = syncStatus;
  }, [syncStatus]);

  async function waitForSync(timeoutMs = 10000) {
    // Give React a tick to flip syncStatus to "syncing" first, so we don't
    // race past a write that hasn't started yet.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const start = Date.now();
    while (syncStatusRef.current === "syncing" && Date.now() - start < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  useEffect(() => {
    fetch("/bulk-import-data.json")
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load bulk-import-data.json (${res.status})`);
        return res.json();
      })
      .then((data: BulkRecipe[]) => {
        setAllRecipes(data);
        const initial: Record<string, RowStatus> = {};
        data.forEach((r) => (initial[r.slug] = "pending"));
        setRows(initial);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Load failed"));
  }, []);

  const knownFolderIds = new Set(folders.map((f) => f.id));
  const existingTitles = new Set(
    existingRecipes.map((existing) => existing.title.trim().toLowerCase()),
  );

  const batches = allRecipes ? splitIntoBatches(allRecipes, BATCH_COUNT) : [];
  const nextBatch = batches[batchesRun];

  async function runBatch(batch: BulkRecipe[]) {
    setRunning(true);
    for (const r of batch) {
      if (existingTitles.has(r.title.trim().toLowerCase())) {
        setRows((prev) => ({ ...prev, [r.slug]: "skipped" }));
        continue;
      }
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
        // Wait for this recipe's cloud write to actually confirm before
        // moving on — see the comment on waitForSync above for why.
        await waitForSync();
        if (syncStatusRef.current === "conflict") {
          // A version conflict came back and didn't resolve to "synced" in
          // time — flag it loudly rather than silently moving on, since a
          // conflict can mean the app pulled down a stale cloud copy.
          setRows((prev) => ({ ...prev, [r.slug]: "error" }));
          continue;
        }
        setRows((prev) => ({ ...prev, [r.slug]: "done" }));
      } catch (err) {
        console.error(`Failed to import ${r.title}`, err);
        setRows((prev) => ({ ...prev, [r.slug]: "error" }));
      }
    }
    setBatchesRun((n) => n + 1);
    setRunning(false);
  }

  if (!ready || (allRecipes === null && !loadError)) {
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

  const doneCount = Object.values(rows).filter((s) => s === "done" || s === "skipped").length;
  const errorCount = Object.values(rows).filter((s) => s === "error").length;
  const total = Object.keys(rows).length;
  const allBatchesRun = batches.length > 0 && batchesRun >= batches.length;

  return (
    <div className="min-h-screen bg-[#f5f5f7] px-4 py-10 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-[#1d1d1f]">
          One-time recipe import
        </h1>
        <p className="mt-2 text-sm text-[#86868b]">
          Signed in as {user.email}. This imports 22 recipes from your recipe
          book into Mains / Sides / Baking, in {batches.length || BATCH_COUNT}{" "}
          batches — click each batch when you're ready for it. Recipes already
          in your library (by title) are skipped automatically, so it's safe
          to re-run a batch.
        </p>

        {loadError && (
          <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            {loadError}
          </div>
        )}

        {!allBatchesRun && nextBatch && (
          <button
            type="button"
            disabled={running}
            onClick={() => runBatch(nextBatch)}
            className="mt-6 rounded-xl bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0077ed] disabled:opacity-50"
          >
            {running
              ? "Importing…"
              : `Import batch ${batchesRun + 1} of ${batches.length} (${nextBatch.length} recipes)`}
          </button>
        )}

        {total > 0 && (
          <div className="mt-6 rounded-2xl bg-white p-4 ring-1 ring-[#e5e5ea]">
            <p className="mb-3 text-sm font-medium text-[#1d1d1f]">
              {doneCount} of {total} accounted for
              {errorCount ? `, ${errorCount} failed` : ""}
              {allBatchesRun ? " — all batches run." : ""}
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

        {allBatchesRun && (
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
