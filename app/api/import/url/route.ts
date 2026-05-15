import { NextResponse } from "next/server";
import { parseRecipeFromHtml } from "@/lib/importParsers";

export async function POST(request: Request) {
  try {
    const { url } = (await request.json()) as { url?: string };

    if (!url?.trim()) {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; RecipeAppBot/1.0; +private-recipe-organizer)",
        Accept: "text/html",
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Could not fetch page (${response.status})` },
        { status: 422 },
      );
    }

    const html = await response.text();
    const recipe = parseRecipeFromHtml(html, parsedUrl.toString());

    return NextResponse.json({ recipe });
  } catch {
    return NextResponse.json(
      { error: "Failed to import from URL. Try manual entry." },
      { status: 500 },
    );
  }
}
