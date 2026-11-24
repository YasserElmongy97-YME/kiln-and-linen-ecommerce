import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { cartItems, carts, products } from "@/db/schema";
import { AppError, conflict, notFound } from "@/lib/errors";
import { calculateTotals, MAX_LINE_QUANTITY } from "@/lib/pricing";

export type CartIssue = "UNAVAILABLE" | "INSUFFICIENT_STOCK";

async function getOrCreateCartId(userId: string): Promise<string> {
  await db.insert(carts).values({ userId }).onConflictDoNothing({ target: carts.userId });
  const [cart] = await db.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId));
  return cart!.id;
}

export async function getCart(userId: string) {
  const cartId = await getOrCreateCartId(userId);
  const rows = await db
    .select({
      productId: products.id,
      slug: products.slug,
      name: products.name,
      imageUrl: products.imageUrl,
      unitPriceCents: products.priceCents,
      stock: products.stock,
      archived: sql<boolean>`${products.archivedAt} is not null`,
      quantity: cartItems.quantity,
    })
    .from(cartItems)
    .innerJoin(products, eq(products.id, cartItems.productId))
    .where(eq(cartItems.cartId, cartId))
    .orderBy(products.name);

  const items = rows.map((row) => {
    const issue: CartIssue | null = row.archived || row.stock === 0
      ? "UNAVAILABLE"
      : row.quantity > row.stock
        ? "INSUFFICIENT_STOCK"
        : null;
    return { ...row, lineTotalCents: row.unitPriceCents * row.quantity, issue };
  });
  return {
    items,
    ...calculateTotals(items),
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    canCheckout: items.length > 0 && items.every((item) => item.issue === null),
  };
}

async function loadPurchasable(productId: string) {
  const [product] = await db
    .select({ id: products.id, name: products.name, stock: products.stock, archivedAt: products.archivedAt })
    .from(products)
    .where(eq(products.id, productId));
  if (!product || product.archivedAt) throw notFound("Product");
  return product;
}

function assertQuantityAvailable(quantity: number, product: { name: string; stock: number }): void {
  if (quantity > MAX_LINE_QUANTITY) {
    throw new AppError(400, "QUANTITY_LIMIT", `You can order up to ${MAX_LINE_QUANTITY} of each item`);
  }
  if (quantity > product.stock) {
    throw conflict(product.stock === 0 ? `${product.name} is out of stock` : `Only ${product.stock} of ${product.name} left`);
  }
}

export async function addToCart(userId: string, productId: string, quantity: number): Promise<void> {
  const product = await loadPurchasable(productId);
  const cartId = await getOrCreateCartId(userId);
  const [existing] = await db
    .select({ quantity: cartItems.quantity })
    .from(cartItems)
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
  assertQuantityAvailable((existing?.quantity ?? 0) + quantity, product);
  await db
    .insert(cartItems)
    .values({ cartId, productId, quantity })
    .onConflictDoUpdate({
      target: [cartItems.cartId, cartItems.productId],
      set: { quantity: sql`${cartItems.quantity} + ${quantity}` },
    });
}

export async function setCartQuantity(userId: string, productId: string, quantity: number): Promise<void> {
  const product = await loadPurchasable(productId);
  assertQuantityAvailable(quantity, product);
  const cartId = await getOrCreateCartId(userId);
  const updated = await db
    .update(cartItems)
    .set({ quantity })
    .where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)))
    .returning({ id: cartItems.id });
  if (updated.length === 0) throw notFound("Cart item");
}

export async function removeFromCart(userId: string, productId: string): Promise<void> {
  const cartId = await getOrCreateCartId(userId);
  await db.delete(cartItems).where(and(eq(cartItems.cartId, cartId), eq(cartItems.productId, productId)));
}

export async function getCartCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${cartItems.quantity}), 0)::int` })
    .from(carts)
    .innerJoin(cartItems, eq(cartItems.cartId, carts.id))
    .where(eq(carts.userId, userId));
  return row?.total ?? 0;
}
