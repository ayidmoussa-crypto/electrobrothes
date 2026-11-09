import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { db } from "@/lib/db";
import { effectiveCost } from "@/lib/stock";
import { AssistantActionError, draftProposal, proposeDraft, proposeProductUpdate, proposeStockChange, stockProposal, updateProposal } from "./actions";
import { fetchStoreImage } from "./client";
import type { AssistantCard, AssistantChoice } from "./rules";

// The assistant's whole reach: reading through these fixed queries, and proposing (stock, new products, edits to
// existing ones). No tool writes to the catalog: only the admin's confirm does.

type Tool = Anthropic.Beta.BetaTool;
type ResultBlock = Anthropic.Beta.BetaToolResultBlockParam["content"];

const nullable = (type: string, description: string) => ({ type: [type, "null"], description });

const obj = (properties: Record<string, unknown>): Tool["input_schema"] => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

const SHARED_TOOLS: Tool[] = [
  {
    name: "search_products",
    description:
      "Search the catalog by words from the product name, brand, category or SKU, including hidden products. Returns each product's colours (variant ids) and current stock. Search with English and Arabic words, and with the category when you have no name.",
    strict: true,
    input_schema: obj({ query: { type: "string", description: "Words to look for, e.g. 'sony casque headphones سماعات'" } }),
  },
  {
    name: "list_taxonomy",
    description: "List all category and brand ids and names. Needed before proposing a new product.",
    strict: true,
    input_schema: obj({}),
  },
  {
    name: "view_product_images",
    description: "See the store's photos of up to 3 products to compare with the admin's photo. Placeholder drawings cannot be shown and are reported as such.",
    input_schema: obj({ product_ids: { type: "array", items: { type: "string" }, maxItems: 3 } }),
  },
  {
    name: "present_choices",
    description: "When unsure which product it is, show the admin up to 3 closest products as buttons. Then end your turn and wait for their choice.",
    input_schema: obj({ question: { type: "string", description: "Short question in Darija" }, product_ids: { type: "array", items: { type: "string" }, maxItems: 3 } }),
  },
  {
    name: "propose_stock_change",
    description:
      "Propose a stock change for one colour, only for an explicit open request from the admin; the admin sees a confirmation card and nothing changes until they confirm it. One call per colour. mode: add = received units, remove = units gone, set = exact new quantity (sold out is set with quantity 0).",
    strict: true,
    input_schema: obj({
      variant_id: { type: "string" },
      mode: { type: "string", enum: ["add", "remove", "set"] },
      quantity: { type: "integer" },
      unit_cost_mad: nullable("integer", "Purchase price per unit in dirhams, only if the admin stated it; else null"),
    }),
  },
  {
    name: "get_product",
    description: "Read one product in full before editing it: names, descriptions, purchase price, and each colour with its price, old price and stock.",
    strict: true,
    input_schema: obj({ product_id: { type: "string" } }),
  },
  {
    name: "propose_product_update",
    description:
      "Propose edits to an existing product in one card: names, descriptions, selling prices, purchase price, and new colours. Every field the admin did not ask to change is null (lists empty). Nothing changes until the admin confirms. Read the product with get_product first. Prices: variant_id null applies to every colour; compare_at_mad is the old price shown struck through, above the new price, or null. new_colors: colours this product does not have yet, with the quantity received (0 if not stated) and a price only if stated (null keeps the main price); color_hex only when the shade is clear, else null. existing_color: only when the product has a single option without colour and a colour is being added; it names the current stock's colour. Texts: only facts that are visible, stated or already in the product; never invent specifications, warranty, delivery or numbers.",
    // Not strict: the API allows at most 16 nullable fields across all strict tools, and this one alone has 10.
    // Its input is still checked by the updateProposal schema before any card is made.
    input_schema: obj({
      product_id: { type: "string" },
      name_ar: nullable("string", "New Arabic name, or null"),
      name_en: nullable("string", "New English name, or null"),
      description_ar: nullable("string", "New Arabic description (10+ characters), or null"),
      description_en: nullable("string", "New English description (10+ characters), or null"),
      unit_cost_mad: nullable("integer", "New purchase price per unit in dirhams, only if stated; applies to new orders only"),
      prices: {
        type: "array",
        description: "Selling price changes, only those the admin stated",
        items: obj({
          variant_id: nullable("string", "One colour, or null for every colour"),
          price_mad: { type: "integer" },
          compare_at_mad: nullable("integer", "Old price struck through, above price_mad, or null"),
        }),
      },
      new_colors: {
        type: "array",
        description: "Colours to add",
        items: obj({
          color_ar: { type: "string" },
          color_en: { type: "string" },
          color_hex: nullable("string", "#RRGGBB when the shade is clear, else null"),
          quantity: { type: "integer" },
          price_mad: nullable("integer", "Only if stated; null uses the product's price"),
        }),
      },
      existing_color: {
        description: "Colour of the current single colourless option, only when adding colours to such a product; else null",
        anyOf: [obj({ color_ar: { type: "string" }, color_en: { type: "string" } }), { type: "null" }],
      },
    }),
  },
  {
    name: "propose_draft_product",
    description:
      "Propose creating a product that is not in the catalog, as a hidden draft; nothing is created until the admin confirms. Only use facts visible in the photo or stated by the admin: never invent specifications or prices. The descriptions must not mention warranty, delivery, returns, replacement, or any number that is not in the product name.",
    strict: true,
    input_schema: obj({
      name_ar: { type: "string" },
      name_en: { type: "string" },
      description_ar: { type: "string", description: "At least 10 characters, only what is visible or stated" },
      description_en: { type: "string", description: "At least 10 characters, only what is visible or stated" },
      category_id: { type: "string" },
      brand_id: nullable("string", "Existing brand id, or null with new_brand_name"),
      new_brand_name: nullable("string", "Only when the brand is readable or stated and is not in the list"),
      price_mad: nullable("integer", "Selling price only if the admin stated it; else null"),
      unit_cost_mad: nullable("integer", "Purchase price only if the admin stated it; else null"),
      use_attached_photo: { type: "boolean", description: "Use the admin's photo as the product image" },
      colors: {
        type: "array",
        description: "One entry per colour with the quantity received (0 if not stated). A product with no colour has one entry with null names.",
        items: obj({ color_ar: nullable("string", "Colour in Arabic"), color_en: nullable("string", "Colour in English"), quantity: { type: "integer" } }),
      },
    }),
  },
];

const REPORT_TOOL: Tool = {
  name: "stock_report",
  description: "Stock analysis data: low-stock colours, stock value at purchase price, the colours with no purchase price yet, and units sold and stock moved over the last N days. Contains no customer data.",
  strict: true,
  input_schema: obj({ days: { type: "integer", description: "Period in days, 1 to 90" } }),
};

export const ESCALATE_TOOL = "request_analysis_model";

const ESCALATE: Tool = {
  name: ESCALATE_TOOL,
  description: "Hand this request to the analysis model. Use it first and alone for analysis: trends, comparisons, recommendations, what to reorder or why, or reports.",
  strict: true,
  input_schema: obj({}),
};

export const haikuTools = [...SHARED_TOOLS, ESCALATE];
export const sonnetTools = [...SHARED_TOOLS, REPORT_TOOL];

export type ToolContext = {
  actor: string;
  model: string;
  origin: string;
  /** Base64 JPEG/PNG/WebP of the admin's most recent photo. */
  photo: string | null;
  cards: AssistantCard[];
  choices: { question: string; options: AssistantChoice[] } | null;
};

const idList = z.array(z.string().max(40)).max(3);

async function searchProducts(query: string) {
  const terms = [...new Set(query.split(/\s+/).filter((t) => t.length >= 2))].slice(0, 8);
  if (!terms.length) return { products: [], note: "empty query" };
  const contains = (t: string) => ({ contains: t, mode: "insensitive" as const });
  const rows = await db.product.findMany({
    where: {
      OR: terms.flatMap((t) => [
        { nameAr: contains(t) },
        { nameEn: contains(t) },
        { brand: { name: contains(t) } },
        { category: { nameAr: contains(t) } },
        { category: { nameEn: contains(t) } },
        { variants: { some: { sku: contains(t) } } },
      ]),
    },
    take: 40,
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      isActive: true,
      brand: { select: { name: true } },
      category: { select: { nameEn: true } },
      variants: { orderBy: { sortOrder: "asc" }, select: { id: true, sku: true, colorAr: true, colorEn: true, storage: true, stock: true } },
    },
  });
  const score = (p: (typeof rows)[number]) => {
    const hay = `${p.nameAr} ${p.nameEn} ${p.brand.name} ${p.category.nameEn} ${p.variants.map((v) => v.sku).join(" ")}`.toLowerCase();
    return terms.filter((t) => hay.includes(t.toLowerCase())).length;
  };
  return {
    products: rows
      .map((p) => ({ p, s: score(p) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 10)
      .map(({ p }) => ({ id: p.id, name_ar: p.nameAr, name_en: p.nameEn, brand: p.brand.name, category: p.category.nameEn, visible_in_store: p.isActive, colors: p.variants })),
  };
}

async function getProduct(id: string) {
  const p = await db.product.findUnique({
    where: { id },
    select: {
      id: true,
      nameAr: true,
      nameEn: true,
      descriptionAr: true,
      descriptionEn: true,
      isActive: true,
      warrantyMonths: true,
      costPrice: true,
      brand: { select: { name: true } },
      category: { select: { nameEn: true } },
      variants: { orderBy: { sortOrder: "asc" }, select: { id: true, colorAr: true, colorEn: true, storage: true, price: true, compareAtPrice: true, stock: true } },
    },
  });
  if (!p) return { error: "product not found" };
  return {
    id: p.id,
    name_ar: p.nameAr,
    name_en: p.nameEn,
    description_ar: p.descriptionAr,
    description_en: p.descriptionEn,
    brand: p.brand.name,
    category: p.category.nameEn,
    visible_in_store: p.isActive,
    warranty_months: p.warrantyMonths,
    purchase_price_mad: p.costPrice,
    colors: p.variants.map((v) => ({ variant_id: v.id, color_ar: v.colorAr, color_en: v.colorEn, storage: v.storage, price_mad: v.price, old_price_mad: v.compareAtPrice, stock: v.stock })),
  };
}

async function listTaxonomy() {
  const [categories, brands] = await Promise.all([
    db.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, nameAr: true, nameEn: true } }),
    db.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  return { categories, brands };
}

async function viewImages(ids: string[], origin: string): Promise<ResultBlock> {
  const products = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, nameEn: true, images: { orderBy: { sortOrder: "asc" }, take: 2, select: { url: true } } },
  });
  const blocks: Exclude<ResultBlock, string | undefined> = [];
  for (const p of products) {
    let shown = 0;
    for (const { url } of p.images) {
      const image = await fetchStoreImage(url, origin);
      if (!image) continue;
      if (!shown) blocks.push({ type: "text", text: `Store photos of product ${p.id} (${p.nameEn}):` });
      blocks.push({ type: "image", source: { type: "base64", media_type: image.type, data: image.data } });
      shown++;
    }
    if (!shown) blocks.push({ type: "text", text: `Product ${p.id} (${p.nameEn}) has only placeholder drawings: it cannot be compared by photo. Do not treat this as a visual match.` });
  }
  return blocks.length ? blocks : "No product found for these ids.";
}

async function presentChoices(question: string, ids: string[], ctx: ToolContext) {
  const rows = await db.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      nameAr: true,
      brand: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
      variants: { orderBy: { sortOrder: "asc" }, select: { colorAr: true } },
    },
  });
  ctx.choices = {
    question,
    options: rows.map((p) => ({
      productId: p.id,
      name: p.nameAr,
      brand: p.brand.name,
      image: p.images[0]?.url ?? null,
      colors: p.variants.flatMap((v) => (v.colorAr ? [v.colorAr] : [])),
    })),
  };
  return { shown: rows.length, next: "End your turn now and wait for the admin's choice." };
}

async function stockReport(days: number) {
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 86_400_000);
  const [variants, sold, moves] = await Promise.all([
    db.variant.findMany({
      select: { sku: true, colorAr: true, stock: true, lowStockAt: true, costPrice: true, product: { select: { nameAr: true, costPrice: true, isActive: true } } },
    }),
    db.orderItem.groupBy({
      by: ["sku", "nameAr", "variantLabel"],
      where: { order: { createdAt: { gte: since }, status: { notIn: ["CANCELLED", "RETURNING", "RETURNED"] } } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 30,
    }),
    db.stockMovement.groupBy({ by: ["reason"], where: { createdAt: { gte: since } }, _sum: { delta: true } }),
  ]);
  const withCost = variants.map((v) => ({ ...v, cost: effectiveCost(v.costPrice, v.product.costPrice) }));
  return {
    period_days: days,
    total_units_in_stock: variants.reduce((n, v) => n + v.stock, 0),
    stock_value_mad: withCost.reduce((n, v) => n + v.stock * (v.cost ?? 0), 0),
    colors_with_stock_but_no_purchase_price: withCost.filter((v) => v.stock > 0 && v.cost === null).length,
    without_purchase_price: withCost
      .filter((v) => v.cost === null)
      .slice(0, 80)
      .map((v) => ({ product: v.product.nameAr, color: v.colorAr, stock: v.stock })),
    low_stock: variants
      .filter((v) => v.product.isActive && v.stock <= v.lowStockAt)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 40)
      .map((v) => ({ product: v.product.nameAr, color: v.colorAr, sku: v.sku, stock: v.stock, alert_at: v.lowStockAt })),
    units_sold: sold.map((s) => ({ product: s.nameAr, color: s.variantLabel, sku: s.sku, units: s._sum.quantity ?? 0 })),
    stock_moved_by_reason: moves.map((m) => ({ reason: m.reason, units: m._sum.delta ?? 0 })),
  };
}

const cardResult = (card: AssistantCard) => ({
  proposal_id: card.id,
  status: "waiting_for_admin_confirmation",
  shown_on_card: card.rows,
  reminder: "Nothing has changed yet. Tell the admin to press the confirm button on the card.",
  ...(card.warning ? { warning: "The admin confirmed this same operation in the last 10 minutes. The card warns them; mention it in one short sentence." } : {}),
});

/** Runs one tool. Bad input and refused proposals go back to Claude as errors it can correct. */
export async function runTool(name: string, input: unknown, ctx: ToolContext): Promise<{ content: ResultBlock; isError?: boolean }> {
  const json = (v: unknown) => ({ content: JSON.stringify(v) });
  const fields = (input ?? {}) as Record<string, unknown>;
  try {
    switch (name) {
      case "search_products":
        return json(await searchProducts(z.string().max(300).parse(fields.query)));
      case "list_taxonomy":
        return json(await listTaxonomy());
      case "view_product_images":
        return { content: await viewImages(idList.parse(fields.product_ids), ctx.origin) };
      case "present_choices":
        return json(await presentChoices(z.string().max(300).parse(fields.question), idList.parse(fields.product_ids), ctx));
      case "propose_stock_change": {
        const card = await proposeStockChange(stockProposal.parse(input), ctx);
        ctx.cards.push(card);
        return json(cardResult(card));
      }
      case "get_product":
        return json(await getProduct(z.string().max(40).parse(fields.product_id)));
      case "propose_product_update": {
        const card = await proposeProductUpdate(updateProposal.parse(input), ctx);
        ctx.cards.push(card);
        return json(cardResult(card));
      }
      case "propose_draft_product": {
        const card = await proposeDraft(draftProposal.parse(input), ctx);
        ctx.cards.push(card);
        return json(cardResult(card));
      }
      case "stock_report":
        return json(await stockReport(z.number().int().parse(fields.days)));
      default:
        return { content: `Unknown tool: ${name}`, isError: true };
    }
  } catch (e) {
    if (e instanceof z.ZodError) return { content: `Invalid input: ${e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, isError: true };
    if (e instanceof AssistantActionError) return { content: e.message, isError: true };
    throw e;
  }
}
