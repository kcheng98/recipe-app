import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import { cleanImportedRecipe, cleanRecipeLine } from "@/lib/cleanRecipeText";
import type { ImportedRecipe } from "./types";

// ─── Types ────────────────────────────────────────────────────────────────────

type JsonLdRecipe = {
  "@type"?: string | string[];
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string } | Array<{ url?: string }>;
  recipeIngredient?: string[];
  recipeInstructions?: Array<string | { "@type"?: string; text?: string; itemListElement?: Array<{ text?: string }> }>;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number | string[];
};

type JsonLdGraph = {
  "@graph"?: JsonLdRecipe[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const RECIPE_CARD_SELECTORS = [
  ".wprm-recipe-container",
  ".tasty-recipes",
  ".tasty-recipe",
  ".mv-create-card",
  "[class*='mv-create']",
  "[itemtype='https://schema.org/Recipe']",
  "[itemtype='http://schema.org/Recipe']",
  "#recipe",
  ".recipe-card",
  "[id*='recipe-container']",
  "[class*='recipe-card']",
  "article.recipe",
];

const PREP_LABELS = /prep\s*time/i;
const COOK_LABELS = /cook\s*time/i;
const TOTAL_LABELS = /total\s*time/i;
const YIELD_LABELS = /yield|serves|serving|portions/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDuration(iso?: string): string {
  if (!iso) return "";
  if (!/^PT/i.test(iso)) return iso.trim();
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match) return iso;
  const hours = match[1] ? `${match[1]} hr` : "";
  const mins = match[2] ? `${match[2]} min` : "";
  return [hours, mins].filter(Boolean).join(" ") || iso;
}

function imageFromSchema(image: JsonLdRecipe["image"]): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    const first = image[0];
    if (!first) return "";
    if (typeof first === "string") return first;
    if (typeof first === "object" && "url" in first) return String(first.url ?? "");
    return "";
  }
  if (typeof image === "object" && "url" in image) return String(image.url ?? "");
  return "";
}

function yieldFromSchema(recipeYield?: string | number | string[]): string {
  if (!recipeYield) return "";
  if (Array.isArray(recipeYield)) return String(recipeYield[0] ?? "");
  return String(recipeYield);
}

function instructionsFromSchema(
  steps?: JsonLdRecipe["recipeInstructions"],
): string {
  if (!steps) return "";
  const lines: string[] = [];
  for (const step of steps) {
    if (typeof step === "string") {
      const clean = cleanRecipeLine(step);
      if (clean) lines.push(clean);
    } else if (step.text) {
      const clean = cleanRecipeLine(step.text);
      if (clean) lines.push(clean);
    } else if (step.itemListElement) {
      for (const sub of step.itemListElement) {
        const clean = cleanRecipeLine(sub.text ?? "");
        if (clean) lines.push(clean);
      }
    }
  }
  return lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
}

function isRecipeType(type: JsonLdRecipe["@type"]): boolean {
  if (!type) return false;
  if (type === "Recipe") return true;
  if (Array.isArray(type)) return type.includes("Recipe");
  return false;
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
  if (!url) return false;
  if (url.startsWith("data:")) return false;
  const lower = url.toLowerCase();
  return !/(avatar|logo|icon|sprite|pixel|gravatar|emoji|badge|ad-|ads\.|banner|placeholder|pin-|long-pin|pinterest.*pin)/i.test(lower);
}

// ─── JSON-LD Parser ───────────────────────────────────────────────────────────

function extractRecipeFromJsonLd(html: string, pageUrl: string): ImportedRecipe | null {
  const $ = cheerio.load(html);
  const scripts = $("script[type='application/ld+json']");
  const candidates: JsonLdRecipe[] = [];

  scripts.each((_, el) => {
    const jsonText = $(el).html()?.trim();
    if (!jsonText) return;
    try {
      const parsed = JSON.parse(jsonText) as JsonLdRecipe | JsonLdRecipe[] | JsonLdGraph;

      if (!Array.isArray(parsed) && "@graph" in parsed && (parsed as JsonLdGraph)["@graph"]) {
        const graph = (parsed as JsonLdGraph)["@graph"] ?? [];
        for (const item of graph) {
          if (isRecipeType(item["@type"])) candidates.push(item);
        }
        return;
      }

      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (isRecipeType(item["@type"])) candidates.push(item);
      }
    } catch {
      // ignore parse errors
    }
  });

  if (candidates.length === 0) return null;
  const recipe = candidates[0];
  if (!recipe.name) return null;

  return {
    title: recipe.name,
    description: recipe.description ?? "",
    imageUrl: resolveUrl(imageFromSchema(recipe.image), pageUrl),
    prepTime: parseDuration(recipe.prepTime),
    cookTime: parseDuration(recipe.cookTime),
    totalTime: parseDuration(recipe.totalTime),
    yields: yieldFromSchema(recipe.recipeYield),
    ingredients: (recipe.recipeIngredient ?? [])
      .map((l) => cleanRecipeLine(l))
      .filter(Boolean)
      .join("\n"),
    instructions: instructionsFromSchema(recipe.recipeInstructions),
  };
}

// ─── HTML Card Parser ─────────────────────────────────────────────────────────

function findRecipeCard($: cheerio.CheerioAPI): cheerio.Cheerio<AnyNode> | null {
  let best: cheerio.Cheerio<AnyNode> | null = null;
  let bestScore = 0;

  for (const selector of RECIPE_CARD_SELECTORS) {
    $(selector).each((_, el) => {
      const card = $(el);
      const score =
        card.find("li").length * 2 +
        card.find("[class*='ingredient']").length * 4 +
        card.find("[class*='instruction'], [class*='direction']").length * 4 +
        card.find("img").length +
        card.find("h2, h3, h4").length;

      if (score > bestScore) {
        bestScore = score;
        best = card;
      }
    });
    if (best && bestScore > 10) break;
  }

  return best;
}

function imageFromCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
  pageUrl: string,
): string {
  const preferred = card.find(
    ".wprm-recipe-image img, .tasty-recipes-image img, .recipe-image img, img[itemprop='image']",
  );
  const pool = preferred.length > 0 ? preferred : card.find("img");
  const urls: string[] = [];
  pool.each((_, el) => {
    const img = $(el);
    const src =
      img.attr("src") ||
      img.attr("data-src") ||
      img.attr("data-lazy-src") ||
      img.attr("data-srcset")?.split(",")[0]?.trim().split(" ")[0];
    if (src) urls.push(resolveUrl(src, pageUrl));
  });
  return urls.find(isLikelyRecipeImage) ?? "";
}

/** Extract ingredients — preserves section headers like "For the Lentils:" */
function ingredientsFromCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
): string {
  const lines: string[] = [];

  // WPRM with ingredient groups (e.g. "For the Lentils", "For the Toast")
  const wprmGroups = card.find(".wprm-recipe-ingredient-group");
  if (wprmGroups.length > 0) {
    wprmGroups.each((_, group) => {
      const header = cleanRecipeLine($(group).find(".wprm-recipe-ingredient-group-name").text());
      if (header) lines.push(`${header}:`);
      $(group).find(".wprm-recipe-ingredient").each((_, el) => {
        const t = cleanRecipeLine($(el).text());
        if (t) lines.push(t);
      });
    });
    if (lines.length > 0) return lines.join("\n");
  }

  // WPRM flat list
  card.find(".wprm-recipe-ingredient").each((_, el) => {
    const t = cleanRecipeLine($(el).text());
    if (t) lines.push(t);
  });
  if (lines.length > 0) return lines.join("\n");

  // Tasty Recipes
card.find(".tasty-recipes-ingredients-body").each((_, section) => {
  $(section).children().each((_, el) => {
    const node = $(el);
    const tag = el.type === "tag" ? el.name : "";
    if (tag === "h4" || tag === "h5") {
      const header = cleanRecipeLine(node.text());
      if (header) lines.push(`${header}:`);
    } else if (tag === "ul" || tag === "ol") {
      node.find("li").each((__, li) => {
        const t = cleanRecipeLine($(li).text());
        if (t) lines.push(t);
      });
    }
  });
});
if (lines.length === 0) {
  card.find(".tasty-recipes-ingredients li").each((_, el) => {
    const t = cleanRecipeLine($(el).text());
    if (t) lines.push(t);
  });
}
  if (lines.length > 0) return lines.join("\n");

  // Schema.org microdata
  card.find("[itemprop='recipeIngredient']").each((_, el) => {
    const t = cleanRecipeLine($(el).text());
    if (t) lines.push(t);
  });
  if (lines.length > 0) return lines.join("\n");

  // Generic: find heading labelled "ingredients" then grab next ul
  card.find("h2, h3, h4").each((_, el) => {
    const node = $(el);
    if (/^ingredients?$/i.test(cleanRecipeLine(node.text()))) {
      node.next("ul").find("li").each((__, li) => {
        const t = cleanRecipeLine($(li).text());
        if (t) lines.push(t);
      });
    }
  });
  if (lines.length > 0) return lines.join("\n");

  // Last resort: largest ul in the card
  card.find("ul").each((_, ul) => {
    const items: string[] = [];
    $(ul).find("li").each((__, li) => {
      const t = cleanRecipeLine($(li).text());
      if (t) items.push(t);
    });
    if (items.length >= 3 && lines.length === 0) lines.push(...items);
  });

  return lines.join("\n");
}

/** Extract instructions — preserves bold text and section headers */
function instructionsFromCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
): string {
  const lines: string[] = [];

  // WPRM with instruction groups
  const wprmGroups = card.find(".wprm-recipe-instruction-group");
  if (wprmGroups.length > 0) {
    wprmGroups.each((_, group) => {
      const header = cleanRecipeLine($(group).find(".wprm-recipe-instruction-group-name").text());
      if (header) lines.push(`${header}:`);
      $(group).find(".wprm-recipe-instruction-text").each((_, el) => {
        const t = cleanRecipeLine($(el).text());
        if (t) lines.push(t);
      });
    });
    if (lines.length > 0) {
      let stepNum = 0;
      return lines.map((l) => {
        if (l.endsWith(":")) return l;
        stepNum++;
        return `${stepNum}. ${l}`;
      }).join("\n");
    }
  }

  // WPRM flat instructions
  card.find(".wprm-recipe-instruction-text").each((_, el) => {
    const t = cleanRecipeLine($(el).text());
    if (t) lines.push(t);
  });
  if (lines.length > 0) return lines.map((l, i) => `${i + 1}. ${l}`).join("\n");

  // Tasty Recipes — walk children to preserve bold text and sub-headers
  card.find(".tasty-recipes-instructions").each((_, section) => {
    $(section).children().each((_, el) => {
      const node = $(el);
      const tag = el.type === "tag" ? el.name : "";
      if (tag === "h4" || tag === "h5") {
        const header = cleanRecipeLine(node.text());
        if (header) lines.push(`${header}:`);
      } else if (tag === "ol" || tag === "ul") {
        node.find("li").each((__, li) => {
          // Read full li text including nested bold/strong tags
          const t = cleanRecipeLine($(li).text());
          if (t) lines.push(t);
        });
      } else if (tag === "p") {
        const t = cleanRecipeLine(node.text());
        if (t) lines.push(t);
      }
    });
  });
  if (lines.length > 0) {
    let stepNum = 0;
    return lines.map((l) => {
      if (l.endsWith(":")) return l;
      stepNum++;
      return `${stepNum}. ${l}`;
    }).join("\n");
  }

  // Schema.org microdata
  card.find("[itemprop='recipeInstructions'] li, [itemprop='recipeInstructions'] p").each((_, el) => {
    const t = cleanRecipeLine($(el).text());
    if (t) lines.push(t);
  });
  if (lines.length > 0) return lines.map((l, i) => `${i + 1}. ${l}`).join("\n");

  // Generic: ol inside card
  const ol = card.find("ol").first();
  if (ol.length > 0) {
    ol.find("li").each((_, el) => {
      const t = cleanRecipeLine($(el).text());
      if (t) lines.push(t);
    });
    if (lines.length > 0) return lines.map((l, i) => `${i + 1}. ${l}`).join("\n");
  }

  return lines.join("\n");
}

function extractByLabel(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
  labelPattern: RegExp,
): string {
  let result = "";

  // 1. itemprop attributes
  if (labelPattern === PREP_LABELS) {
    result = card.find("[itemprop='prepTime']").attr("content") ||
             card.find("[itemprop='prepTime']").text() || "";
  } else if (labelPattern === COOK_LABELS) {
    result = card.find("[itemprop='cookTime']").attr("content") ||
             card.find("[itemprop='cookTime']").text() || "";
  } else if (labelPattern === TOTAL_LABELS) {
    result = card.find("[itemprop='totalTime']").attr("content") ||
             card.find("[itemprop='totalTime']").text() || "";
  } else if (labelPattern === YIELD_LABELS) {
    result = card.find("[itemprop='recipeYield']").text() || "";
  }
  if (result.trim()) return parseDuration(cleanRecipeLine(result));

  // 2. WPRM containers
  if (labelPattern === PREP_LABELS) {
    result = card.find(".wprm-recipe-prep_time-container, .wprm-recipe-prep-time-container").text();
  } else if (labelPattern === COOK_LABELS) {
    result = card.find(".wprm-recipe-cook_time-container, .wprm-recipe-cook-time-container").text();
  } else if (labelPattern === TOTAL_LABELS) {
    result = card.find(".wprm-recipe-total_time-container, .wprm-recipe-total-time-container").text();
  } else if (labelPattern === YIELD_LABELS) {
    result = card.find(".wprm-recipe-servings-container, .wprm-recipe-servings-with-unit").text() ||
             card.find(".wprm-recipe-servings").text();
  }
  if (result.trim()) return cleanRecipeLine(result);

  // 3. Tasty Recipes spans
  if (labelPattern === PREP_LABELS) {
    result = card.find(".tasty-recipes-prep-time").text();
  } else if (labelPattern === COOK_LABELS) {
    result = card.find(".tasty-recipes-cook-time").text();
  } else if (labelPattern === TOTAL_LABELS) {
    result = card.find(".tasty-recipes-total-time").text();
  } else if (labelPattern === YIELD_LABELS) {
    result = card.find(".tasty-recipes-yield").text();
  }
  if (result.trim()) return cleanRecipeLine(result);

  // 4. Generic label scan
  const labelEls = card.find("dt, th, .label, [class*='label'], b, strong");
  labelEls.each((_, el) => {
    if (result) return;
    const labelText = $(el).text().trim();
    if (!labelPattern.test(labelText)) return;
    const sibling = $(el).next("dd, td, span");
    if (sibling.length > 0) {
      result = cleanRecipeLine(sibling.text());
      return;
    }
    const parentNext = $(el).parent().next();
    if (parentNext.length > 0) {
      result = cleanRecipeLine(parentNext.text());
    }
  });

  return result ? parseDuration(result) : "";
}

function parseRecipeCard(
  $: cheerio.CheerioAPI,
  card: cheerio.Cheerio<AnyNode>,
  pageUrl: string,
): ImportedRecipe | null {
  const title = cleanRecipeLine(
    card.find(".wprm-recipe-name, .tasty-recipes-title, [itemprop='name'], h2, h3, h4").first().text()
  );
  if (!title) return null;

  console.log("TASTY INGREDIENTS FOUND:", card.find(".tasty-recipes-ingredients").length);
  console.log("TASTY INGREDIENTS BODY FOUND:", card.find(".tasty-recipes-ingredients-body").length);
  const ingredients = ingredientsFromCard($, card);
  console.log("INGREDIENTS RESULT:", ingredientsFromCard($, card).slice(0, 200));
  const instructions = instructionsFromCard($, card);
  if (!ingredients && !instructions) return null;

  const description = cleanRecipeLine(
    card.find(".wprm-recipe-summary, .tasty-recipes-description, [itemprop='description']").first().text()
  ).slice(0, 300);

  return {
    title,
    description,
    imageUrl: imageFromCard($, card, pageUrl),
    prepTime: extractByLabel($, card, PREP_LABELS),
    cookTime: extractByLabel($, card, COOK_LABELS),
    totalTime: extractByLabel($, card, TOTAL_LABELS),
    yields: extractByLabel($, card, YIELD_LABELS),
    ingredients,
    instructions,
  };
}

// ─── Image Selection ──────────────────────────────────────────────────────────

function pickBestImage(
  $: cheerio.CheerioAPI,
  pageUrl: string,
  jsonLdImage: string,
  cardImage: string,
): string {
  const og = resolveUrl($('meta[property="og:image"]').attr("content") ?? "", pageUrl);
  const twitter = resolveUrl($('meta[name="twitter:image"]').attr("content") ?? "", pageUrl);

  if (og && !og.startsWith("data:")) return og;
  if (jsonLdImage && isLikelyRecipeImage(jsonLdImage)) return jsonLdImage;
  if (cardImage && isLikelyRecipeImage(cardImage)) return cardImage;
  if (twitter && isLikelyRecipeImage(twitter)) return twitter;
  return "";
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function parseRecipeFromHtml(html: string, sourceUrl: string): ImportedRecipe {
  const $ = cheerio.load(html);
  const jsonLd = extractRecipeFromJsonLd(html, sourceUrl);
  const card = findRecipeCard($);
  const cardData = card ? parseRecipeCard($, card, sourceUrl) : null;

  const image = pickBestImage(
    $,
    sourceUrl,
    jsonLd?.imageUrl ?? "",
    cardData?.imageUrl ?? "",
  );

  if (jsonLd || cardData) {
    return cleanImportedRecipe({
      // Title & description: JSON-LD is cleaner
      title: jsonLd?.title || cardData?.title || "",
      description: jsonLd?.description || cardData?.description || "",
      imageUrl: image,
      // Times & yields: JSON-LD preferred (structured, reliable)
      prepTime: jsonLd?.prepTime || cardData?.prepTime || "",
      cookTime: jsonLd?.cookTime || cardData?.cookTime || "",
      totalTime: jsonLd?.totalTime || cardData?.totalTime || "",
      yields: jsonLd?.yields || cardData?.yields || "",
      // Ingredients & instructions: card scraper preferred
      // preserves section headers and bold text that JSON-LD strips
      ingredients: cardData?.ingredients || jsonLd?.ingredients || "",
      instructions: cardData?.instructions || jsonLd?.instructions || "",
      sourceUrl,
    });
  }

  // Last resort: meta tags only
  return cleanImportedRecipe({
    title:
      $('meta[property="og:title"]').attr("content")?.trim() ||
      $("title").first().text().trim() ||
      "Imported Recipe",
    description: $('meta[property="og:description"]').attr("content")?.trim() ?? "",
    imageUrl: image,
    prepTime: "",
    cookTime: "",
    totalTime: "",
    yields: "",
    ingredients: "",
    instructions:
      "Could not find a recipe card on this page. Try a different link or paste the recipe manually.",
    sourceUrl,
  });
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
    prepTime: "",
    cookTime: "",
    totalTime: "",
    yields: "",
    ingredients: body,
    instructions: body,
  });
}
