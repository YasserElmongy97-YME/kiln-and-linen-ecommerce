import { and, asc, desc, eq, gte, ilike, isNull, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { notFound } from "@/lib/errors";
import type { CatalogQuery } from "@/lib/validation";

export const PAGE_SIZE = 9;

const productColumns = {
  id: products.id,
  slug: products.slug,
  name: products.name,
  description: products.description,
  priceCents: products.priceCents,
  stock: products.stock,
  imageUrl: products.imageUrl,
  categoryId: products.categoryId,
  categoryName: categories.name,
  categorySlug: categories.slug,
};

export type CatalogProduct = Awaited<ReturnType<typeof listProducts>>["items"][number];

const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");

const ORDER_BY = {
  newest: desc(products.createdAt),
  "price-asc": asc(products.priceCents),
  "price-desc": desc(products.priceCents),
  name: asc(products.name),
} as const;

export async function listProducts(query: CatalogQuery) {
  const filters: (SQL | undefined)[] = [isNull(products.archivedAt)];
  if (query.q) filters.push(ilike(products.name, `%${escapeLike(query.q)}%`));
  if (query.category) filters.push(eq(categories.slug, query.category));
  if (query.minPrice !== undefined) filters.push(gte(products.priceCents, Math.round(query.minPrice * 100)));
  if (query.maxPrice !== undefined) filters.push(lte(products.priceCents, Math.round(query.maxPrice * 100)));
  const where = and(...filters);

  const [{ total = 0 } = {}] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where);

  const items = await db
    .select(productColumns)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(where)
    .orderBy(ORDER_BY[query.sort], asc(products.id))
    .limit(PAGE_SIZE)
    .offset((query.page - 1) * PAGE_SIZE);

  return { items, total, page: query.page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getProductBySlug(slug: string) {
  const [product] = await db
    .select(productColumns)
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.slug, slug), isNull(products.archivedAt)));
  if (!product) throw notFound("Product");
  return product;
}

export async function listCategories() {
  return db.select().from(categories).orderBy(asc(categories.name));
}
