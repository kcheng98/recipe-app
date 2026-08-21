"use client";

import { useState } from "react";
import type { ImportedRecipe, RecipeDraft } from "@/lib/types";
import { draftFromImport } from "@/lib/recipeUtils";
import { normalizeImageFile } from "@/lib/heic";

type ImportMethod = "manual" | "url" | "photo" | "pdf";

type ImportMethodsProps = {
  folderId: string;
  onDraftReady: (draft: RecipeDraft) => void;
};

export default function ImportMethods({
  folderId,
  onDraftReady,
}: ImportMethodsProps) {
  const [method, setMethod] = useState<ImportMethod>("manual");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ocrProgress, setOcrProgress] = useState("");

  function finishImport(
    partial: ImportedRecipe,
    sourceType: RecipeDraft["sourceType"],
    sourceUrl?: string,
  ) {
    onDraftReady(draftFromImport(partial, folderId, sourceType, sourceUrl));
  }

  async function importFromUrl() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      finishImport(data.recipe, "url", url.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setLoading(false);
    }
  }

  async function importFromPdf(file: File | null) {
    if (!file) return;
    setError("");
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/import/pdf", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "PDF import failed");
      finishImport(data.recipe, "pdf");
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF import failed");
    } finally {
      setLoading(false);
    }
  }

  async function importFromPhoto(file: File | null) {
    if (!file) return;
    setError("");
    setLoading(true);
    setOcrProgress("Starting OCR…");
    try {
      // iPhone Camera Roll photos default to HEIC/HEIF, which the OCR
      // engine (and the browser preview below) can't decode — convert to
      // JPEG first if needed.
      const normalizedFile = await normalizeImageFile(file);

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const {
        data: { text },
      } = await worker.recognize(normalizedFile);
      await worker.terminate();

      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      finishImport(
        {
          title: lines[0] ?? "Recipe from photo",
          description: "Imported from photo — please review and edit.",
          ingredients: text,
          instructions: text,
          imageUrl: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(normalizedFile);
          }),
        },
        "photo",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not read photo. Try a clearer image or manual entry.",
      );
    } finally {
      setLoading(false);
      setOcrProgress("");
    }
  }

  const tabs: { id: ImportMethod; label: string }[] = [
    { id: "manual", label: "Manual" },
    { id: "url", label: "Blog link" },
    { id: "photo", label: "Photo" },
    { id: "pdf", label: "PDF" },
  ];

  return (
    <div className="rounded-2xl bg-white p-6 ring-1 ring-[#e5e5ea]">
      <h2 className="mb-1 text-lg font-semibold text-[#1d1d1f]">
        How do you want to add this recipe?
      </h2>
      <p className="mb-4 text-sm text-[#86868b]">
        Import from a link or file, then edit everything to match how you cook.
      </p>

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setMethod(tab.id);
              setError("");
            }}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              method === tab.id
                ? "bg-[#1d1d1f] text-white"
                : "bg-[#f5f5f7] text-[#515154] ring-1 ring-[#e5e5ea]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {method === "manual" && (
          <div>
            <p className="text-sm text-[#86868b]">
              Start with a blank recipe. You will fill in every field on the next
              screen.
            </p>
            <button
              type="button"
              onClick={() => finishImport({ title: "" }, "manual")}
              className="mt-4 rounded-xl bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue to editor
            </button>
          </div>
        )}

        {method === "url" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#515154]">
              Blog or recipe page URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/your-recipe"
              className="w-full rounded-xl border border-[#e5e5ea] px-4 py-2.5 text-[15px] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20"
            />
            <button
              type="button"
              disabled={loading || !url.trim()}
              onClick={importFromUrl}
              className="rounded-xl bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              Import from link
            </button>
            <p className="text-xs text-[#86868b]">
              Works best on blogs that use standard recipe formatting. You can
              always edit the result.
            </p>
          </div>
        )}

        {method === "photo" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#515154]">
              Upload a photo of a recipe
            </label>
            <input
              type="file"
              accept="image/*,.heic,.heif"
              disabled={loading}
              onChange={(e) => importFromPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[#515154]"
            />
            <p className="text-xs text-[#86868b]">
              Text is read from the image on your device. Clear, straight-on photos
              work best.
            </p>
          </div>
        )}

        {method === "pdf" && (
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[#515154]">
              Upload a PDF recipe
            </label>
            <input
              type="file"
              accept="application/pdf"
              disabled={loading}
              onChange={(e) => importFromPdf(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-[#515154]"
            />
            <p className="text-xs text-[#86868b]">
              Text is extracted automatically. Review and edit before saving.
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {(loading || ocrProgress) && (
        <p className="mt-4 text-sm text-[#0071e3]">{ocrProgress || "Working…"}</p>
      )}
    </div>
  );
}
