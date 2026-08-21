/**
 * Client helper for app/api/import/image — fetches a remote image URL
 * through the server (sidestepping CORS/canvas-tainting) and returns it as
 * a same-origin data URL ready to hand to the cropper.
 */
export async function fetchImageAsDataUrl(url: string): Promise<string> {
  const res = await fetch("/api/import/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error ?? "Could not load that image.");
  }
  return data.dataUrl as string;
}
