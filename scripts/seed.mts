import "dotenv/config";
import { isNull, sql } from "drizzle-orm";
import { db, pool } from "../src/db";
import { categories, products } from "../src/db/schema";

const CATALOG: Record<string, { slug: string; items: [name: string, slug: string, price: number, stock: number, description: string][] }> = {
  Ceramics: {
    slug: "ceramics",
    items: [
      ["Stoneware Mug", "stoneware-mug", 2400, 40, "Hand-thrown 350 ml mug with a satin pine-green glaze and a bone-white band. Dishwasher and microwave safe."],
      ["Fluted Vase", "fluted-vase", 6800, 12, "A 28 cm vase with vertical flutes that catch the light. Glazed inside, so it holds water as well as dried stems."],
      ["Serving Bowl", "serving-bowl", 5400, 4, "Wide 30 cm bowl in terracotta slip. Sturdy enough for family-style salads and deep enough for fruit."],
    ],
  },
  Lighting: {
    slug: "lighting",
    items: [
      ["Arc Table Lamp", "arc-table-lamp", 14500, 9, "Steel base with a linen drum shade that gives off a warm, even glow. Uses any E27 bulb, up to 40 W."],
      ["Brass Candle Holder", "brass-candle-holder", 4200, 25, "Solid brass, weighted base, fits standard 2 cm taper candles. It darkens gracefully with handling."],
      ["Paper Pendant", "paper-pendant", 9800, 0, "Washi-paper dome on a 2 m fabric cord with a ceiling canopy. Currently sold out; back in stock soon."],
    ],
  },
  Textiles: {
    slug: "textiles",
    items: [
      ["Linen Throw", "linen-throw", 11800, 15, "Stonewashed European flax linen, 130 x 180 cm. Softens with every wash and sits lightly across a sofa."],
      ["Wool Cushion", "wool-cushion", 7600, 22, "Slate-blue lambswool cover, 50 x 50 cm, with a removable feather insert and a hidden zip."],
      ["Table Runner", "table-runner", 5900, 18, "Heavy cotton jacquard runner, 40 x 180 cm, woven with a fine stripe at each end."],
    ],
  },
  "Kitchen & Table": {
    slug: "kitchen-table",
    items: [
      ["Oak Cutting Board", "oak-cutting-board", 6200, 3, "End-grain oak board, 40 x 28 cm, finished with food-safe oil. Gentle on knives and easy to refinish."],
      ["Glass Carafe Set", "glass-carafe-set", 5200, 30, "Hand-blown 1 L carafe with a matching tumbler that doubles as a lid."],
      ["Walnut Spoon Set", "walnut-spoon-set", 3600, 35, "Three spoons turned from a single walnut board. Oil occasionally; hand wash only."],
    ],
  },
};

for (const [name, { slug, items }] of Object.entries(CATALOG)) {
  const [category] = await db
    .insert(categories)
    .values({ name, slug })
    .onConflictDoUpdate({ target: categories.slug, set: { name } })
    .returning();
  for (const [productName, productSlug, priceCents, stock, description] of items) {
    await db
      .insert(products)
      .values({ name: productName, slug: productSlug, priceCents, stock, description, imageUrl: `/products/${productSlug}.svg`, categoryId: category!.id })
      .onConflictDoNothing({ target: products.slug });
  }
}

const [{ total } = { total: 0 }] = await db.select({ total: sql<number>`count(*)::int` }).from(products).where(isNull(products.archivedAt));
await pool.end();
console.log(`Seed complete. Catalog holds ${total} products.`);
