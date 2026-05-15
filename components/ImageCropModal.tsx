"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { getCroppedImageDataUrl } from "@/lib/cropImage";

type ImageCropModalProps = {
  imageSrc: string;
  onCancel: () => void;
  onComplete: (dataUrl: string) => void;
};

export default function ImageCropModal({
  imageSrc,
  onCancel,
  onComplete,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, area: Area) => {
    setCroppedArea(area);
  }, []);

  async function handleSave() {
    if (!croppedArea) return;
    setSaving(true);
    try {
      const dataUrl = await getCroppedImageDataUrl(imageSrc, croppedArea);
      onComplete(dataUrl);
    } catch {
      alert("Could not crop this image. Try uploading a different file.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[#1d1d1f]">
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={4 / 3}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <div className="space-y-4 bg-white p-4 pb-8">
        <label className="block text-sm font-medium text-[#515154]">
          Zoom
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="mt-2 w-full"
          />
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl bg-[#f5f5f7] py-3 text-sm font-medium text-[#1d1d1f]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !croppedArea}
            onClick={handleSave}
            className="flex-1 rounded-xl bg-[#0071e3] py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Use photo"}
          </button>
        </div>
      </div>
    </div>
  );
}
