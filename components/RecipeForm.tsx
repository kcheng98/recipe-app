"use client";

import { useRef, useState } from "react";
import ImageCropModal from "@/components/ImageCropModal";
import RecipeImage from "@/components/RecipeImage";
import { useApp } from "@/context/AppProvider";
import type { RecipeDraft } from "@/lib/types";
import { readFileAsDataUrl } from "@/lib/recipeUtils";
import { normalizeImageFile } from "@/lib/heic";
import { fetchImageAsDataUrl } from "@/lib/imageProxy";
import { PillarFieldEditors } from "@/components/PillarFieldEditors";

type RecipeFormProps = {
  draft: RecipeDraft;
  onChange: (draft: RecipeDraft) => void;
  onSubmit: () => void;
  submitLabel: string;
  onCancel: () => void;
};

const inputClass =
  "mt-1 w-full rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] px-4 py-2.5 text-[15px] outline-none focus:border-[#0071e3] focus:ring-2 focus:ring-[#0071e3]/20";

const labelClass = "block text-sm font-medium text-[#515154]";

export default function RecipeForm({
  draft,
  onChange,
  onSubmit,
  submitLabel,
  onCancel,
}: RecipeFormProps) {
  const { labels, folders, addLabel } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newLabelName, setNewLabelName] = useState("");
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [coverError, setCoverError] = useState("");
  const [coverBusy, setCoverBusy] = useState(false);

  function update<K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) {
    onChange({ ...draft, [key]: value });
  }

  function toggleLabel(labelId: string) {
    const has = draft.labelIds.includes(labelId);
    update(
      "labelIds",
      has
        ? draft.labelIds.filter((id) => id !== labelId)
        : [...draft.labelIds, labelId],
    );
  }

  async function handleCoverUpload(file: File | null) {
    if (!file) return;
    setCoverError("");
    setCoverBusy(true);
    try {
      // iPhone Camera Roll photos default to HEIC/HEIF, which browsers can't
      // decode into an <img>/canvas — convert to JPEG first if needed.
      const normalized = await normalizeImageFile(file);
      const dataUrl = await readFileAsDataUrl(normalized);
      setCropSrc(dataUrl);
    } catch (err) {
      setCoverError(
        err instanceof Error
          ? err.message
          : "Could not read that photo. Try a different file.",
      );
    } finally {
      setCoverBusy(false);
      // Allow re-selecting the same file again after an error
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function openCropForCurrentImage() {
    if (!draft.imageUrl) return;
    if (draft.imageUrl.startsWith("data:")) {
      setCropSrc(draft.imageUrl);
      return;
    }
    // Pasted image URL — fetch it through the server-side proxy first so the
    // cropper always operates on a same-origin data URL and never hits a
    // CORS-blocked or canvas-tainting source image.
    setCoverError("");
    setCoverBusy(true);
    try {
      const dataUrl = await fetchImageAsDataUrl(draft.imageUrl);
      setCropSrc(dataUrl);
    } catch (err) {
      setCoverError(
        err instanceof Error ? err.message : "Could not load that image for cropping.",
      );
    } finally {
      setCoverBusy(false);
    }
  }

  function handleCreateLabel() {
    const name = newLabelName.trim();
    if (!name) return;
    const label = addLabel(name);
    update("labelIds", [...draft.labelIds, label.id]);
    setNewLabelName("");
  }

  return (
    <>
      {cropSrc ? (
        <ImageCropModal
          imageSrc={cropSrc}
          onCancel={() => setCropSrc(null)}
          onComplete={(dataUrl) => {
            update("imageUrl", dataUrl);
            setCropSrc(null);
          }}
        />
      ) : null}
    <form
      className="mx-auto max-w-3xl space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <section className="rounded-2xl bg-white p-6 ring-1 ring-[#e5e5ea]">
        <h2 className="mb-4 text-lg font-semibold text-[#1d1d1f]">Basics</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input
              className={inputClass}
              value={draft.title}
              onChange={(e) => update("title", e.target.value)}
              required
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Prep time</label>
            <input
              className={inputClass}
              value={draft.prepTime}
              onChange={(e) => update("prepTime", e.target.value)}
              placeholder="e.g. 15 min"
            />
          </div>
          <div>
            <label className={labelClass}>Cook time</label>
            <input
              className={inputClass}
              value={draft.cookTime}
              onChange={(e) => update("cookTime", e.target.value)}
              placeholder="e.g. 30 min"
            />
          </div>
          <div>
            <label className={labelClass}>Total time</label>
            <input
              className={inputClass}
              value={draft.totalTime}
              onChange={(e) => update("totalTime", e.target.value)}
              placeholder="e.g. 45 min"
            />
          </div>
          <div>
            <label className={labelClass}>Yields</label>
            <input
              className={inputClass}
              value={draft.yields}
              onChange={(e) => update("yields", e.target.value)}
              placeholder="e.g. 4 servings"
            />
          </div>
        </div>  
          <div>
            <label className={labelClass}>Folder</label>
            <select
              className={inputClass}
              value={draft.folderId}
              onChange={(e) => update("folderId", e.target.value)}
            >
              {folders.map((folder) => (
                <option key={folder.id} value={folder.id}>
                  {folder.icon} {folder.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-[#e5e5ea]">
        <h2 className="mb-2 text-lg font-semibold text-[#1d1d1f]">Cover photo</h2>
        <p className="mb-4 text-sm text-[#86868b]">
          Upload a photo or paste an image URL from the web.
        </p>

        {draft.imageUrl ? (
          <div className="relative mb-4 aspect-video max-h-64 overflow-hidden rounded-xl bg-[#f5f5f7]">
            <RecipeImage src={draft.imageUrl} alt="Cover preview" fill />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={coverBusy}
            onClick={() => fileRef.current?.click()}
            className="rounded-xl bg-[#f5f5f7] px-4 py-2 text-sm font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:opacity-50"
          >
            {coverBusy ? "Working…" : "Upload image"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.heic,.heif"
            disabled={coverBusy}
            className="hidden"
            onChange={(e) => handleCoverUpload(e.target.files?.[0] ?? null)}
          />
          {draft.imageUrl ? (
            <button
              type="button"
              disabled={coverBusy}
              onClick={openCropForCurrentImage}
              className="rounded-xl bg-[#f5f5f7] px-4 py-2 text-sm font-medium text-[#1d1d1f] hover:bg-[#e8e8ed] disabled:opacity-50"
            >
              {coverBusy ? "Working…" : "Crop & reposition"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              update("imageUrl", "");
              setCoverError("");
            }}
            className="rounded-xl px-4 py-2 text-sm text-[#86868b] hover:bg-[#f5f5f7]"
          >
            Remove
          </button>
        </div>

        {coverError ? (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {coverError}
          </p>
        ) : null}

        <div className="mt-4">
          <label className={labelClass}>Image URL (optional)</label>
          <input
            className={inputClass}
            value={draft.imageUrl.startsWith("data:") ? "" : draft.imageUrl}
            onChange={(e) => {
              update("imageUrl", e.target.value);
              setCoverError("");
            }}
            placeholder="https://..."
          />
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-[#e5e5ea]">
        <h2 className="mb-2 text-lg font-semibold text-[#1d1d1f]">Your labels</h2>
        <p className="mb-4 text-sm text-[#86868b]">
          Only labels you create—no auto-suggestions.
        </p>

        {labels.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {labels.map((label) => {
              const active = draft.labelIds.includes(label.id);
              return (
                <button
                  key={label.id}
                  type="button"
                  onClick={() => toggleLabel(label.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-[#1d1d1f] text-white"
                      : "bg-[#f5f5f7] text-[#515154] ring-1 ring-[#e5e5ea]"
                  }`}
                >
                  {label.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 flex gap-2">
          <input
            className={inputClass + " mt-0"}
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            placeholder="New label name"
          />
          <button
            type="button"
            onClick={handleCreateLabel}
            className="shrink-0 rounded-xl bg-[#1d1d1f] px-4 py-2.5 text-sm font-medium text-white"
          >
            Add label
          </button>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-[#e5e5ea]">
        <h2 className="mb-4 text-lg font-semibold text-[#1d1d1f]">Recipe</h2>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Ingredients (one per line)</label>
            <textarea
              className={inputClass + " min-h-[140px] resize-y"}
              value={draft.ingredients}
              onChange={(e) => update("ingredients", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Instructions</label>
            <textarea
              className={inputClass + " min-h-[180px] resize-y"}
              value={draft.instructions}
              onChange={(e) => update("instructions", e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Notes (optional)</label>
            <textarea
              className={inputClass + " min-h-[100px] resize-y"}
              value={draft.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Any personal notes, substitutions, tips…"
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 ring-1 ring-[#e5e5ea]">
        <h2 className="mb-1 text-lg font-semibold text-[#1d1d1f]">Source</h2>
        <p className="mb-4 text-sm text-[#86868b]">Optional — for citing the original recipe.</p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Author</label>
            <input
              className={inputClass}
              value={draft.author}
              onChange={(e) => update("author", e.target.value)}
              placeholder="e.g. Melissa Clark"
            />
          </div>
          <div>
            <label className={labelClass}>Site</label>
            <input
              className={inputClass}
              value={draft.recipeSite}
              onChange={(e) => update("recipeSite", e.target.value)}
              placeholder="e.g. NYT Cooking"
            />
          </div>
          <div>
            <label className={labelClass}>URL</label>
            <input
              className={inputClass}
              value={draft.sourceUrl ?? ""}
              onChange={(e) => update("sourceUrl", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>
      </section>

      <PillarFieldEditors 
        draft={draft} 
        onChange={(patch) => onChange({ ...draft, ...patch })} 
      />
    </form>
    </>
  );
}
