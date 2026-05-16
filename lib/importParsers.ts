import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { cleanImportedRecipe, cleanRecipeLine } from "@/lib/cleanRecipeText";
import type { ImportedRecipe } from "./types";

type JsonLdRecipe = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string };
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { text?: string }>;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number;
};

const RECIPE_CARD_SELECTORS = [
  ".wprm-recipe-container",
  "[class*='wprm-recipe']",
  ".tasty-recipes",
  ".tasty-recipes-recipe",
  "[class*='mv-create-card']",
  ".recipe-card",
  "#recipe",
  "[itemtype='https://schema.org/Recipe']",
  "[itemtype='http://schema.org/Recipe']",
  "[typeof='Recipe']",
  "article.recipe",
];

function parseDuration(iso?: string): string {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return iso;
  const hours = match[1] ? `${match[1]} hr` : "";
  const mins = match[2] ? `${match[2]} min` : "";
  return [hours, mins].filter(Boolean).join(" ") || iso;
}

function imageFromSchema(image: JsonLdRecipe["image"]): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return imageFromSchema(image[0]);
  if (typeof image === "object" && image !== null && "url" in image) {
    return String((image as { url?: string }).url ?? "");
  }
  return "";
}

function instructionsFromSchema(
  steps?: JsonLdRecipe["recipeInstructions"],
): string {
  if (!steps) return "";
  return steps
    .map((step) => (typeof step === "string" ? step : step.text ?? ""))
    .filter(Boolean)
    .map((s, i) => `${i + 1}. ${cleanRecipeLine(s)}`)
    .join("\n");
}

function isRecipeType(type: JsonLdRecipe["@type"]): boolean {
  if (type === "Recipe") return true;
  return Array.isArray(type) && type.includes("Recipe");
}

function resolveUrl(src: string | undefined, pageUrl: string): string {
  if (!src?.trim()) return "";
  try {
    return new URL(src.trim(), pageUrl).href;
  } catch {
    return src.trim();
  }
}

function isLikelyRecipeImage(url: string): boolean {
  const lower = url.toLowerCase();
  return !/(avatar|logo|icon|sprite|pixel|gravatar|emoji|badge|ad-|ads\.)/.test(
    lower,
  );
}

function firstImageInCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
  pageUrl: string,
): string {
  const preferred = card.find(
    ".wprm-recipe-image img, .recipe-image img, img[itemprop='image'], .tasty-recipes-image img",
  );
  const searchRoot = preferred.length > 0 ? preferred : card.find("img");

  const urls: string[] = [];
  searchRoot.each((_, el) => {
    const img = $(el);
    const src =
      img.attr("src") ||
      img.attr("data-src") ||
      img.attr("data-lazy-src") ||
      img.attr("data-srcset")?.split(",")[0]?.trim().split(" ")[0];
    if (src) urls.push(resolveUrl(src, pageUrl));
  });

  return urls.find(isLikelyRecipeImage) ?? urls[0] ?? "";
}

function ingredientList(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
): string {
  const lines: string[] = [];

  card.find("[itemprop='recipeIngredient']").each((_, el) => {
    const text = cleanRecipeLine($(el).text());
    if (text) lines.push(text);
  });
  if (lines.length > 0) return lines.join("\n");

  card
    .find(
      ".wprm-recipe-ingredient, .tasty-recipes-ingredients li, li[class*='ingredient']",
    )
    .each((_, el) => {
      const text = cleanRecipeLine($(el).text());
      if (text) lines.push(text);
    });
  if (lines.length > 0) return lines.join("\n");

  card.find(".wprm-recipe-ingredients li, ul.ingredients li").each((_, el) => {
    const text = cleanRecipeLine($(el).text());
    if (text) lines.push(text);
  });

  return lines.join("\n");
}

function instructionList(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
): string {
  const lines: string[] = [];

  card.find("[itemprop='recipeInstructions'] li, [itemprop='recipeInstructions'] p").each(
    (_, el) => {
      const text = cleanRecipeLine($(el).text());
      if (text) lines.push(text);
    },
  );

  if (lines.length > 0) {
    return lines.map((line, i) => `${i + 1}. ${line}`).join("\n");
  }

  const instructionRoot =
    card.find(".wprm-recipe-instructions, .tasty-recipes-instructions, [class*='instruction']").first()
      .length > 0
      ? card.find(".wprm-recipe-instructions, .tasty-recipes-instructions, [class*='instruction']").first()
      : card.find("ol").first();

  instructionRoot.find("li").each((_, el) => {
    const text = cleanRecipeLine($(el).text());
    if (text) lines.push(`${lines.length + 1}. ${text}`);
  });

  if (lines.length > 0) return lines.join("\n");

  instructionRoot.find("p").each((_, el) => {
    const text = cleanRecipeLine($(el).text());
    if (text) lines.push(text);
  });

  return lines.join("\n");
}

function parseJsonLd(html: string, pageUrl: string): ImportedRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $("script[type='application/ld+json']");

  for (let i = 0; i < scripts.length; i++) {
    const jsonText = $(scripts[i]).html()?.trim();
    if (!jsonText) continue;
    try {
      const parsed = JSON.parse(jsonText) as JsonLdRecipe | JsonLdRecipe[];
      const items = Array.isArray(parsed) ? parsed : [parsed];
      const recipe = items.find((item) => isRecipeType(item["@type"]));
      if (recipe?.name) {
        const imageUrl = resolveUrl(imageFromSchema(recipe.image), pageUrl);
        return {
          title: recipe.name,
          description: recipe.description ?? "",
          imageUrl,
          prepTime: parseDuration(recipe.prepTime),
          cookTime: parseDuration(recipe.cookTime),
          totalTime: parseDuration(recipe.totalTime),
          yields: String(recipe.recipeYield ?? ""),
          ingredients: (recipe.recipeIngredient ?? [])
            .map((line) => cleanRecipeLine(line))
            .filter(Boolean)
            .join("\n"),
          instructions: instructionsFromSchema(recipe.recipeInstructions),
        };
      }
    } catch {
      // try next block
    }
  }
  return null;
}

function parseRecipeCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
  pageUrl: string,
): ImportedRecipe | null {
  const title = cleanRecipeLine(
    card
      .find("h2, h3, h4, .wprm-recipe-name, .recipe-title, [class*='recipe-title']")
      .first()
      .text() || card.find("[itemprop='name']").first().text(),
  );

  if (!title) return null;

  const ingredients = ingredientList($, card);
  const instructions = instructionList($, card);
  const imageUrl = firstImageInCard($, card, pageUrl);

  const yields = cleanRecipeLine(
    card
      .find(".wprm-recipe-servings, [class*='servings'], [itemprop='recipeYield']")
      .first()
      .text() || card.find("[itemprop='recipeYield']").text(),
  );

  const prepTime = cleanRecipeLine(
    card
      .find(".wprm-recipe-prep-time-container, .wprm-recipe-prep-time, [itemprop='prepTime']")
      .first()
      .text(),
  );

  const cookTime = cleanRecipeLine(
    card
      .find(".wprm-recipe-cook-time-container, .wprm-recipe-cook-time, [itemprop='cookTime']")
      .first()
      .text(),
  );

  const totalTime = cleanRecipeLine(
    card
      .find(".wprm-recipe-total-time-container, .wprm-recipe-total-time, [itemprop='totalTime']")
      .first()
      .text(),
  );

  const description = cleanRecipeLine(
    card
      .find(".wprm-recipe-summary, .recipe-description, [itemprop='description']")
      .first()
      .text(),
  ).slice(0, 200);

  if (!ingredients && !instructions) return null;

  return {
    title,
    description,
    imageUrl,
    prepTime,
    cookTime,
    totalTime,
    yields,
    ingredients,
    instructions,
  };
}

function findBestRecipeCard($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  let best: cheerio.Cheerio<AnyNode> | null = null;
  let bestScore = 0;

  for (const selector of RECIPE_CARD_SELECTORS) {
    $(selector).each((_, el) => {
      const card = $(el);
      const score =
        card.find("li").length * 2 +
        card.find("[class*='ingredient']").length * 3 +
        card.find("[class*='instruction']").length * 3 +
        card.find("img").length * 2 +
        card.find("h2, h3").length;

      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    });
  }

  return best;
}

function pickImage(
  pageUrl: string,
  cardImage: string,
  jsonLdImage: string,
  $: cheerio.CheerioAPI,
): string {
  const og = $('meta[property="og:image"]').attr("content");
  const resolved = [
    cardImage,
    jsonLdImage,
    og ? resolveUrl(og, pageUrl) : "",
  ]
    .map((url) => resolveUrl(url, pageUrl))
    .find((url) => url && isLikelyRecipeImage(url));

  return resolved ?? "";
}

export function parseRecipeFromHtml(html: string, sourceUrl: string): ImportedRecipe {
  const jsonLd = parseJsonLd(html, sourceUrl);
  const $ = cheerio.load(html);
  const card = findBestRecipeCard($);

  let result: ImportedRecipe;

  if (card) {
    const fromCard = parseRecipeCard($, card, sourceUrl);
    if (fromCard) {
      result = {
        ...fromCard,
        prepTime: fromCard.prepTime || jsonLd?.prepTime || "",
        cookTime: fromCard.cookTime || jsonLd?.cookTime || "",
        totalTime: fromCard.totalTime || jsonLd?.totalTime || "",
        yields: fromCard.yields || jsonLd?.yields || "",
        imageUrl: pickImage(
          sourceUrl,
          fromCard.imageUrl ?? "",
          jsonLd?.imageUrl ?? "",
          $,
        ),
        ingredients: fromCard.ingredients || jsonLd?.ingredients || "",
        instructions: fromCard.instructions || jsonLd?.instructions || "",
        sourceUrl,
      };
      return cleanImportedRecipe(result);
    }
  }

  if (jsonLd) {
    result = {
      ...jsonLd,
      imageUrl: pickImage(sourceUrl, "", jsonLd.imageUrl ?? "", $),
      sourceUrl,
    };
    return cleanImportedRecipe(result);
  }

  const title =
    $('meta[property="og:title"]').attr("content")?.trim() ||
    $("title").first().text().trim() ||
    "Imported Recipe";

  result = {
    title,
    description: $('meta[property="og:description"]').attr("content")?.trim() ?? "",
    imageUrl: pickImage(sourceUrl, "", "", $),
    ingredients: "",
    instructions:
      "We could not find a recipe card on this page. Try a different link or paste the recipe manually.",
    sourceUrl,
  };

  return cleanImportedRecipe(result);
}

export function parseRecipeFromText(text: string): ImportedRecipe {
  const lines = text
    .split(/\r?\n/)
    .map((l) => cleanRecipeLine(l))
    .filter(Boolean);

  const title = lines[0] ?? "Imported Recipe";
  const body = lines.slice(1).join("\n");

  return cleanImportedRecipe({
    title,
    description: body.slice(0, 160),
    ingredients: body,
    instructions: body,
  });
}
