/**
 * lib/heic.ts
 *
 * iPhones save Camera Roll photos as HEIC/HEIF by default. Browsers generally
 * can't decode that format into an <img>/canvas (which both the cover-photo
 * cropper and the OCR "Photo" import rely on), so an unconverted HEIC upload
 * silently fails at the decode step.
 *
 * This detects HEIC/HEIF files and converts them to a JPEG File client-side,
 * using a dynamically-imported WASM decoder so the cost is only paid when a
 * HEIC file actually shows up (same lazy-load pattern already used for the
 * tesseract.js OCR import elsewhere in this app).
 */

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif"]);
const HEIC_EXTENSIONS = [".heic", ".heif"];

export function isHeicFile(file: File): boolean {
  if (HEIC_MIME_TYPES.has(file.type.toLowerCase())) return true;
  const name = file.name.toLowerCase();
  return HEIC_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * If `file` looks like HEIC/HEIF, converts it to a JPEG File and returns
 * that. Otherwise returns the original file unchanged.
 *
 * Throws a descriptive Error if the file is HEIC but conversion fails (e.g.
 * an unsupported HEIC variant), so callers can show the user a clear message
 * instead of a generic "could not load image" failure.
 */
export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) return file;

  let heic2any: (opts: {
    blob: Blob;
    toType?: string;
    quality?: number;
  }) => Promise<Blob | Blob[]>;

  try {
    ({ default: heic2any } = await import("heic2any"));
  } catch {
    throw new Error(
      "This looks like a HEIC/HEIF photo (the default iPhone format) and this app couldn't load its converter. Try again, or share the photo as JPEG instead.",
    );
  }

  try {
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const jpegBlob = Array.isArray(result) ? result[0] : result;
    const newName = file.name.replace(/\.heic$|\.heif$/i, "") + ".jpg";
    return new File([jpegBlob], newName, { type: "image/jpeg" });
  } catch {
    throw new Error(
      "This HEIC/HEIF photo couldn't be converted automatically. Try exporting/sharing it as JPEG first, then upload that.",
    );
  }
}
