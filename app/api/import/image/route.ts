import { NextResponse } from "next/server";

/**
 * Fetches a remote image server-side and hands it back as a same-origin
 * data URL. This exists solely to work around browser CORS/canvas-tainting
 * restrictions: when a user pastes an image URL and then tries to crop it,
 * loading that image directly in the browser fails for any site that
 * doesn't send permissive CORS headers (most recipe blogs don't). Routing
 * it through this server-side fetch first means the client-side cropper
 * only ever operates on a same-origin data URL, so it always works
 * regardless of the source site's CORS policy.
 */
export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url?.trim()) {
      return NextResponse.json({ error: "Image URL is required" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      return NextResponse.json({ error: "Invalid image URL" }, { status: 400 });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RecipeAppBot/1.0; +private-recipe-organizer)",
        Accept: "image/*",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `This image's source wouldn't load it (${response.status}). Try downloading and re-uploading it instead.` },
        { status: 422 },
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) {
      return NextResponse.json(
        { error: "That link doesn't point to an image." },
        { status: 422 },
      );
    }

    // Cap at 15MB to avoid holding huge payloads in memory / as a data URL.
    const MAX_BYTES = 15 * 1024 * 1024;
    const contentLength = Number(response.headers.get("content-length") ?? "0");
    if (contentLength && contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "That image is too large to load." }, { status: 413 });
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "That image is too large to load." }, { status: 413 });
    }

    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;
    return NextResponse.json({ dataUrl });
  } catch {
    return NextResponse.json(
      { error: "Could not load that image. Try downloading and re-uploading it instead." },
      { status: 500 },
    );
  }
}
