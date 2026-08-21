export type CropArea = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function getCroppedImageDataUrl(
  imageSrc: string,
  crop: CropArea,
): Promise<string> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not crop image");

  canvas.width = crop.width;
  canvas.height = crop.height;

  ctx.drawImage(
    image,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    crop.width,
    crop.height,
  );

  return canvas.toDataURL("image/jpeg", 0.92);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    // Only needed for cross-origin (http/https) sources — setting it on a
    // data: URL is harmless but unnecessary. Callers should route remote
    // URLs through /api/import/image first (see lib/imageProxy.ts) so this
    // almost always receives a same-origin data: URL and never hits a
    // CORS-tainted canvas; this stays as a defensive fallback.
    if (!src.startsWith("data:")) {
      image.crossOrigin = "anonymous";
    }
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}
