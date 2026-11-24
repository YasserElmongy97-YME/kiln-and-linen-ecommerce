import { asc, count, desc, eq, inArray, like, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, orders, payments, products } from "@/db/schema";
import { conflict, notFound } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import type { ProductInput } from "@/lib/validation";

export const LOW_STOCK_THRESHOLD = 5;

export async function getDashboard() {
  const [statusCounts, [revenue], [productCount], lowStock] = await Promise.all([
    db.select({ status: orders.status, total: count() }).from(orders).groupBy(orders.status),
    db
      .select({ cents: sql<number>`coalesce(sum(${payments.amountCents}), 0)::int` })
      .from(payments)
      .where(eq(payments.status, "SUCCEEDED")),
    db.select({ total: count() }).from(products).where(sql`${products.archivedAt} is null`),
    db
      .select({ id: products.id, name: products.name, stock: products.stock })
      .from(products)
      .where(sql`${products.archivedAt} is null and ${products.stock} <= ${LOW_STOCK_THRESHOLD}`)
      .orderBy(asc(products.stock))
      .limit(8),
  ]);
  return {
    revenueCents: revenue?.cents ?? 0,
    activeProducts: productCount?.total ?? 0,
    ordersByStatus: Object.fromEntries(statusCounts.map((row) => [row.status, row.total])) as Record<string, number>,
    lowStock,
  };
}

export async function listAdminProducts() {
  return db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      priceCents: products.priceCents,
      stock: products.stock,
      archivedAt: products.archivedAt,
      categoryName: categories.name,
    })
    .from(products)
    .innerJoin(categories, eq(categories.id, products.categoryId))
    .orderBy(desc(products.createdAt));
}

export async function getAdminProduct(id: string) {
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) throw notFound("Product");
  return product;
}

async function uniqueProductSlug(name: string): Promise<string> {
  const base = slugify(name) || "product";
  const taken = await db.select({ slug: products.slug }).from(products).where(like(products.slug, `${base}%`));
  const slugs = new Set(taken.map((row) => row.slug));
  let candidate = base;
  for (let n = 2; slugs.has(candidate); n++) candidate = `${base}-${n}`;
  return candidate;
}

async function assertCategoryExists(categoryId: string): Promise<void> {
  const [found] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, categoryId));
  if (!found) throw notFound("Category");
}

export async function createProduct(input: ProductInput) {
  await assertCategoryExists(input.categoryId);
  const [created] = await db.insert(products).values({ ...input, slug: await uniqueProductSlug(input.name) }).returning();
  return created!;
}

export async function updateProduct(id: string, patch: Partial<ProductInput> & { archived?: boolean }) {
  const { archived, ...fields } = patch;
  if (fields.categoryId) await assertCategoryExists(fields.categoryId);
  const changes = { ...fields, ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }) };
  if (Object.keys(changes).length === 0) return getAdminProduct(id);
  const [updated] = await db.update(products).set(changes).where(eq(products.id, id)).returning();
  if (!updated) throw notFound("Product");
  return updated;
}

export async function listCategoriesWithCounts() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      // Qualified by hand: in a single-table select Drizzle renders bare column names, which the subquery would resolve to products.id.
      productCount: sql<number>`(select count(*)::int from products p where p.category_id = categories.id)`,
    })
    .from(categories)
    .orderBy(asc(categories.name));
}

export async function createCategory(name: string) {
  const slug = slugify(name);
  const [created] = await db.insert(categories).values({ name, slug }).onConflictDoNothing({ target: categories.slug }).returning();
  if (!created) throw conflict("A category with this name already exists");
  return created;
}

export async function renameCategory(id: string, name: string) {
  const [updated] = await db.update(categories).set({ name }).where(eq(categories.id, id)).returning();
  if (!updated) throw notFound("Category");
  return updated;
}

export async function deleteCategory(id: string): Promise<void> {
  const [{ total = 0 } = {}] = await db.select({ total: count() }).from(products).where(inArray(products.categoryId, [id]));
  if (total > 0) throw conflict("Move or archive this category's products before deleting it");
  const deleted = await db.delete(categories).where(eq(categories.id, id)).returning({ id: categories.id });
  if (deleted.length === 0) throw notFound("Category");
}
