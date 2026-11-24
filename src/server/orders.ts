import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import { cartItems, carts, orderItems, orders, payments, products, users } from "@/db/schema";
import { AppError, conflict, notFound } from "@/lib/errors";
import { calculateTotals } from "@/lib/pricing";
import { canAdminSetOrderStatus, type OrderStatus } from "@/lib/states";
import type { ShippingInput } from "@/lib/validation";

const UNIQUE_VIOLATION = "23505";

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === UNIQUE_VIOLATION;
}

export async function getOrderDetail(orderId: string, scope: { userId?: string } = {}) {
  const [order] = await db
    .select({ order: orders, customerEmail: users.email, customerName: users.name })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(scope.userId ? and(eq(orders.id, orderId), eq(orders.userId, scope.userId)) : eq(orders.id, orderId));
  if (!order) throw notFound("Order");

  const [items, orderPayments] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(orderItems.productName),
    db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(desc(payments.createdAt)),
  ]);
  return { ...order.order, customerEmail: order.customerEmail, customerName: order.customerName, items, payments: orderPayments };
}

export type OrderDetail = Awaited<ReturnType<typeof getOrderDetail>>;

const latestPaymentStatus = sql<string | null>`(select p.status from payments p where p.order_id = ${orders.id} order by p.created_at desc limit 1)`;

export async function listOrders(filter: { userId?: string; status?: OrderStatus } = {}) {
  const conditions = [
    filter.userId ? eq(orders.userId, filter.userId) : undefined,
    filter.status ? eq(orders.status, filter.status) : undefined,
  ];
  return db
    .select({
      id: orders.id,
      status: orders.status,
      totalCents: orders.totalCents,
      createdAt: orders.createdAt,
      customerEmail: users.email,
      paymentStatus: latestPaymentStatus,
      itemCount: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = ${orders.id})`,
    })
    .from(orders)
    .innerJoin(users, eq(users.id, orders.userId))
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(200);
}

async function findOrderByKey(executor: Pick<Tx, "select">, userId: string, idempotencyKey: string) {
  const [existing] = await executor
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.idempotencyKey, idempotencyKey)));
  return existing?.id;
}

async function createOrderFromCart(tx: Tx, userId: string, shipping: ShippingInput, idempotencyKey: string): Promise<{ orderId: string; created: boolean }> {
  const [cart] = await tx.select({ id: carts.id }).from(carts).where(eq(carts.userId, userId)).for("update");
  // A concurrent request with the same key may have finished while we waited for the cart lock.
  const alreadyCreated = await findOrderByKey(tx, userId, idempotencyKey);
  if (alreadyCreated) return { orderId: alreadyCreated, created: false };
  const lines = cart
    ? await tx
        .select({ productId: cartItems.productId, quantity: cartItems.quantity })
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id))
    : [];
  if (!cart || lines.length === 0) throw new AppError(400, "EMPTY_CART", "Your cart is empty");

  const catalog = await tx
    .select()
    .from(products)
    .where(inArray(products.id, lines.map((l) => l.productId)))
    .orderBy(products.id)
    .for("update");
  const byId = new Map(catalog.map((p) => [p.id, p]));

  const priced = lines.map((line) => {
    const product = byId.get(line.productId);
    if (!product || product.archivedAt) throw conflict("An item in your cart is no longer available");
    if (line.quantity > product.stock) throw conflict(`Only ${product.stock} of ${product.name} left`);
    return { product, quantity: line.quantity, unitPriceCents: product.priceCents };
  });

  const totals = calculateTotals(priced);
  const [order] = await tx
    .insert(orders)
    .values({
      userId,
      idempotencyKey,
      ...totals,
      shippingName: shipping.name,
      shippingPhone: shipping.phone,
      shippingLine1: shipping.line1,
      shippingCity: shipping.city,
      shippingPostalCode: shipping.postalCode,
      shippingCountry: shipping.country,
    })
    .returning({ id: orders.id });

  await tx.insert(orderItems).values(
    priced.map(({ product, quantity, unitPriceCents }) => ({
      orderId: order!.id,
      productId: product.id,
      productName: product.name,
      imageUrl: product.imageUrl,
      unitPriceCents,
      quantity,
    })),
  );
  for (const { product, quantity } of priced) {
    await tx.update(products).set({ stock: sql`${products.stock} - ${quantity}` }).where(eq(products.id, product.id));
  }
  await tx.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  return { orderId: order!.id, created: true };
}

/** Creates an order from the server-side cart. Repeating the same idempotency key returns the same order. */
export async function checkout(userId: string, shipping: ShippingInput, idempotencyKey: string): Promise<{ orderId: string; created: boolean }> {
  const existing = await findOrderByKey(db, userId, idempotencyKey);
  if (existing) return { orderId: existing, created: false };

  try {
    return await db.transaction((tx) => createOrderFromCart(tx, userId, shipping, idempotencyKey));
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const raced = await findOrderByKey(db, userId, idempotencyKey);
    if (!raced) throw error;
    return { orderId: raced, created: false };
  }
}

export async function updateOrderStatus(orderId: string, to: OrderStatus): Promise<void> {
  await db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw notFound("Order");
    if (!canAdminSetOrderStatus(order.status, to)) {
      throw conflict(`Cannot move an order from ${order.status} to ${to}`);
    }
    if (to === "CANCELLED") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      for (const item of items) {
        await tx.update(products).set({ stock: sql`${products.stock} + ${item.quantity}` }).where(eq(products.id, item.productId));
      }
      await tx
        .update(payments)
        .set({ status: "REFUNDED", updatedAt: new Date() })
        .where(and(eq(payments.orderId, orderId), eq(payments.status, "SUCCEEDED")));
    }
    await tx.update(orders).set({ status: to }).where(eq(orders.id, orderId));
  });
}
