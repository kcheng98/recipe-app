import { NextResponse } from "next/server";
import { parseRecipeFromText } from "@/lib/importParsers";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "PDF file is required" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const pdfParse = (await import("pdf-parse")).default;
    const result = await pdfParse(buffer);

    const text = result.text?.trim() ?? "";
    if (!text) {
      return NextResponse.json(
        { error: "No text found in PDF. Try a photo or manual entry." },
        { status: 422 },
      );
    }

    const recipe = parseRecipeFromText(text);
    return NextResponse.json({ recipe });
  } catch {
    return NextResponse.json(
      { error: "Failed to read PDF. Try photo OCR or manual entry." },
      { status: 500 },
    );
  }
}
