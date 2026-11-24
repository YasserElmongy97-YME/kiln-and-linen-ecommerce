import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { orderItems, orders, payments, products } from "@/db/schema";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as getCart } from "@/app/api/cart/route";
import { POST as addItem } from "@/app/api/cart/items/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { GET as listOrders } from "@/app/api/orders/route";
import { GET as getOrder } from "@/app/api/orders/[id]/route";
import { POST as pay } from "@/app/api/orders/[id]/pay/route";
import { POST as webhook } from "@/app/api/payments/webhook/route";
import { signPayload } from "@/server/payments/webhook";
import { call, CARDS, createCatalog, createUser, emptyContext, PASSWORD, resetDb, SHIPPING } from "../helpers";

let catalog: Awaited<ReturnType<typeof createCatalog>>;
let cookie: string;
let keyCounter = 0;
const key = () => `test-key-${++keyCounter}-${Math.random().toString(36).slice(2)}`;

async function signIn(email: string): Promise<string> {
  await createUser(email);
  const res = await call(login, "/api/auth/login", { body: { email, password: PASSWORD } });
  return res.setCookie!.split(";")[0]!;
}

const add = (who: string, slug: string, quantity: number) =>
  call(addItem, "/api/cart/items", { cookie: who, body: { productId: catalog.products[slug]!.id, quantity } });

const startCheckout = (who: string, idempotencyKey = key(), shipping: unknown = SHIPPING) =>
  call(checkout, "/api/checkout", { cookie: who, headers: { "idempotency-key": idempotencyKey }, body: { shipping } });

const payOrder = (who: string, orderId: string, card: unknown, idempotencyKey = key()) =>
  call(pay, `/api/orders/${orderId}/pay`, { cookie: who, params: { id: orderId }, headers: { "idempotency-key": idempotencyKey }, body: card });

const stockOf = async (slug: string) => (await db.select().from(products).where(eq(products.slug, slug)))[0]!.stock;

async function orderWithMug(who = cookie, quantity = 2) {
  await add(who, "stoneware-mug", quantity);
  const res = await startCheckout(who);
  return res.body.orderId as string;
}

beforeEach(async () => {
  await resetDb();
  catalog = await createCatalog();
  cookie = await signIn("mona@example.com");
});

describe("checkout", () => {
  it("creates an order with server-calculated totals, reserves stock and empties the cart", async () => {
    await add(cookie, "stoneware-mug", 2);
    await add(cookie, "fluted-vase", 1);
    const res = await startCheckout(cookie);
    expect(res.status).toBe(201);

    const order = (await call(getOrder, `/api/orders/${res.body.orderId}`, { cookie, params: { id: res.body.orderId } })).body.order;
    expect(order).toMatchObject({ status: "PENDING_PAYMENT", subtotalCents: 11600, shippingCents: 900, totalCents: 12500 });
    expect(order.items.map((i: { quantity: number }) => i.quantity).sort()).toEqual([1, 2]);

    expect(await stockOf("stoneware-mug")).toBe(8);
    expect(await stockOf("fluted-vase")).toBe(2);
    expect((await call(getCart, "/api/cart", { cookie })).body.items).toEqual([]);
  });

  it("returns the same order for a repeated idempotency key and reserves stock once", async () => {
    await add(cookie, "stoneware-mug", 2);
    const idempotencyKey = key();
    const first = await startCheckout(cookie, idempotencyKey);
    const second = await startCheckout(cookie, idempotencyKey);
    expect(second.status).toBe(200);
    expect(second.body.orderId).toBe(first.body.orderId);
    expect(await db.select().from(orders)).toHaveLength(1);
    expect(await stockOf("stoneware-mug")).toBe(8);
  });

  it("creates only one order when the same checkout is submitted concurrently", async () => {
    await add(cookie, "stoneware-mug", 1);
    const idempotencyKey = key();
    const results = await Promise.all([startCheckout(cookie, idempotencyKey), startCheckout(cookie, idempotencyKey), startCheckout(cookie, idempotencyKey)]);
    expect(new Set(results.map((r) => r.body.orderId)).size).toBe(1);
    expect(await db.select().from(orders)).toHaveLength(1);
    expect(await stockOf("stoneware-mug")).toBe(9);
  });

  it("requires an idempotency key, a non-empty cart and valid shipping details", async () => {
    await add(cookie, "stoneware-mug", 1);
    const missingKey = await call(checkout, "/api/checkout", { cookie, body: { shipping: SHIPPING } });
    expect(missingKey.status).toBe(400);
    const invalid = await startCheckout(cookie, key(), { ...SHIPPING, phone: "x", postalCode: "" });
    expect(invalid.status).toBe(400);
    expect(Object.keys(invalid.body.error.details)).toEqual(expect.arrayContaining(["shipping.phone", "shipping.postalCode"]));

    expect((await startCheckout(cookie)).status).toBe(201);
    const empty = await startCheckout(cookie);
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("EMPTY_CART");
  });

  it("refuses to oversell: the second buyer is rejected and no order is created", async () => {
    const other = await signIn("other@example.com");
    await add(cookie, "fluted-vase", 3);
    await add(other, "fluted-vase", 3);
    expect((await startCheckout(cookie)).status).toBe(201);
    const rejected = await startCheckout(other);
    expect(rejected.status).toBe(409);
    expect(await db.select().from(orders)).toHaveLength(1);
    expect(await stockOf("fluted-vase")).toBe(0);
  });

  it("keeps order prices when the catalog price changes later", async () => {
    const orderId = await orderWithMug();
    await db.update(products).set({ priceCents: 9900, name: "Renamed Mug" }).where(eq(products.slug, "stoneware-mug"));
    const order = (await call(getOrder, `/api/orders/${orderId}`, { cookie, params: { id: orderId } })).body.order;
    expect(order.totalCents).toBe(4800 + 900);
    expect(order.items[0]).toMatchObject({ productName: "Stoneware Mug", unitPriceCents: 2400 });
  });

  it("uses the stored price at checkout time, never a client-supplied one", async () => {
    await add(cookie, "stoneware-mug", 1);
    const res = await call(checkout, "/api/checkout", {
      cookie,
      headers: { "idempotency-key": key() },
      body: { shipping: SHIPPING, totalCents: 1, items: [{ unitPriceCents: 1 }] },
    });
    const order = (await db.select().from(orders).where(eq(orders.id, res.body.orderId)))[0]!;
    expect(order.totalCents).toBe(2400 + 900);
  });
});

describe("order access control", () => {
  it("lets customers see only their own orders", async () => {
    const orderId = await orderWithMug();
    const intruder = await signIn("intruder@example.com");
    expect((await call(getOrder, `/api/orders/${orderId}`, { cookie: intruder, params: { id: orderId } })).status).toBe(404);
    expect((await call(listOrders, "/api/orders", { cookie: intruder })).body.orders).toEqual([]);
    expect((await call(listOrders, "/api/orders", { cookie })).body.orders).toHaveLength(1);
    expect((await call(getOrder, `/api/orders/${orderId}`, { params: { id: orderId } })).status).toBe(401);
  });

  it("does not let another customer pay for someone else's order", async () => {
    const orderId = await orderWithMug();
    const intruder = await signIn("intruder@example.com");
    expect((await payOrder(intruder, orderId, CARDS.success)).status).toBe(404);
    expect((await db.select().from(payments))).toHaveLength(0);
  });
});

describe("sandbox payment", () => {
  it("marks the order paid after a successful test card and records a reference", async () => {
    const orderId = await orderWithMug();
    const res = await payOrder(cookie, orderId, CARDS.success);
    expect(res.status).toBe(200);
    expect(res.body.payment).toMatchObject({ status: "SUCCEEDED", provider: "sandbox", amountCents: 5700, cardLast4: "4242", orderId });
    expect(res.body.payment.reference).toMatch(/^sbx_/);

    const order = (await call(getOrder, `/api/orders/${orderId}`, { cookie, params: { id: orderId } })).body.order;
    expect(order.status).toBe("PAID");
    expect(order.payments).toHaveLength(1);
  });

  it("records a failed payment, leaves the order unpaid and allows a retry", async () => {
    const orderId = await orderWithMug();
    const failed = await payOrder(cookie, orderId, CARDS.declined);
    expect(failed.body.payment).toMatchObject({ status: "FAILED", failureReason: "Your card was declined" });
    expect((await call(getOrder, `/api/orders/${orderId}`, { cookie, params: { id: orderId } })).body.order.status).toBe("PENDING_PAYMENT");

    const insufficient = await payOrder(cookie, orderId, CARDS.insufficient);
    expect(insufficient.body.payment.failureReason).toMatch(/insufficient/);

    const retry = await payOrder(cookie, orderId, CARDS.success);
    expect(retry.body.payment.status).toBe("SUCCEEDED");
    expect((await call(getOrder, `/api/orders/${orderId}`, { cookie, params: { id: orderId } })).body.order.status).toBe("PAID");
    expect(await db.select().from(payments)).toHaveLength(3);
  });

  it("never succeeds for a card that is not a documented test card", async () => {
    const orderId = await orderWithMug();
    const res = await payOrder(cookie, orderId, CARDS.realLooking);
    expect(res.body.payment).toMatchObject({ status: "FAILED", failureReason: "Sandbox mode accepts only test cards" });
  });

  it("returns the same payment for a repeated idempotency key without charging twice", async () => {
    const orderId = await orderWithMug();
    const idempotencyKey = key();
    const first = await payOrder(cookie, orderId, CARDS.success, idempotencyKey);
    const repeat = await payOrder(cookie, orderId, CARDS.success, idempotencyKey);
    expect(repeat.body.payment.id).toBe(first.body.payment.id);
    expect(await db.select().from(payments)).toHaveLength(1);
  });

  it("rejects a new payment on an order that is already paid", async () => {
    const orderId = await orderWithMug();
    await payOrder(cookie, orderId, CARDS.success);
    const again = await payOrder(cookie, orderId, CARDS.success);
    expect(again.status).toBe(409);
    expect(await db.select().from(payments)).toHaveLength(1);
  });

  it("keeps exactly one successful payment when two attempts race", async () => {
    const orderId = await orderWithMug();
    await Promise.all([payOrder(cookie, orderId, CARDS.success), payOrder(cookie, orderId, CARDS.success)]);
    const rows = await db.select().from(payments).where(eq(payments.orderId, orderId));
    expect(rows.filter((p) => p.status === "SUCCEEDED")).toHaveLength(1);
    expect(rows.every((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")).toBe(true);
    expect((await db.select().from(orders))[0]!.status).toBe("PAID");
  });

  it("takes the charged amount from the stored order and stores no card number or CVC", async () => {
    const orderId = await orderWithMug();
    await call(pay, `/api/orders/${orderId}/pay`, {
      cookie,
      params: { id: orderId },
      headers: { "idempotency-key": key() },
      body: { ...CARDS.success, amountCents: 1 },
    });
    const [payment] = await db.select().from(payments);
    expect(payment!.amountCents).toBe(5700);
    expect(JSON.stringify(payment)).not.toContain("4242424242424242");
    expect(JSON.stringify(payment)).not.toContain("123");
  });

  it("validates card input and requires an idempotency key", async () => {
    const orderId = await orderWithMug();
    const badCard = await payOrder(cookie, orderId, { ...CARDS.success, cardNumber: "4242424242424241" });
    expect(badCard.status).toBe(400);
    const noKey = await call(pay, `/api/orders/${orderId}/pay`, { cookie, params: { id: orderId }, body: CARDS.success });
    expect(noKey.status).toBe(400);
  });
});

describe("payment webhook", () => {
  async function pendingPayment() {
    const orderId = await orderWithMug();
    const [payment] = await db
      .insert(payments)
      .values({ orderId, provider: "sandbox", reference: "sbx_pending_0001", idempotencyKey: key(), amountCents: 5700 })
      .returning();
    return { orderId, payment: payment! };
  }

  const send = (event: unknown, signature?: string | null) => {
    const raw = JSON.stringify(event);
    const headers: Record<string, string> = {};
    const sig = signature === undefined ? signPayload(raw) : signature;
    if (sig) headers["x-signature"] = sig;
    return webhook(new Request("http://localhost:3000/api/payments/webhook", { method: "POST", body: raw, headers }), emptyContext);
  };

  const succeeded = { id: "evt_00000001", type: "payment.succeeded", reference: "sbx_pending_0001", amountCents: 5700 };

  it("rejects missing or forged signatures and changes nothing", async () => {
    const { payment } = await pendingPayment();
    expect((await send(succeeded, null)).status).toBe(401);
    expect((await send(succeeded, "sha256=deadbeef")).status).toBe(401);
    expect((await send(succeeded, signPayload("different body"))).status).toBe(401);
    const [row] = await db.select().from(payments).where(eq(payments.id, payment.id));
    expect(row!.status).toBe("PENDING");
  });

  it("applies a signed event once and treats replays as no-ops", async () => {
    const { orderId } = await pendingPayment();
    const first = await (await send(succeeded)).json();
    const replay = await (await send(succeeded)).json();
    expect(first.applied).toBe(true);
    expect(replay.applied).toBe(false);
    expect((await db.select().from(orders).where(eq(orders.id, orderId)))[0]!.status).toBe("PAID");
  });

  it("does not let a late failure event overwrite a succeeded payment", async () => {
    await pendingPayment();
    await send(succeeded);
    await send({ ...succeeded, id: "evt_00000002", type: "payment.failed" });
    expect((await db.select().from(payments))[0]!.status).toBe("SUCCEEDED");
  });

  it("rejects an event whose amount does not match the payment", async () => {
    const { payment } = await pendingPayment();
    expect((await send({ ...succeeded, amountCents: 100 })).status).toBe(400);
    expect((await db.select().from(payments).where(eq(payments.id, payment.id)))[0]!.status).toBe("PENDING");
  });

  it("returns 404 for unknown references and 400 for malformed events", async () => {
    expect((await send({ ...succeeded, reference: "sbx_unknown_0001" })).status).toBe(404);
    expect((await send({ id: "x" })).status).toBe(400);
  });

  it("refunds a late success for an order that was already cancelled", async () => {
    const { orderId } = await pendingPayment();
    await db.update(orders).set({ status: "CANCELLED" }).where(eq(orders.id, orderId));
    await send(succeeded);
    expect((await db.select().from(payments))[0]!.status).toBe("REFUNDED");
    expect((await db.select().from(orders))[0]!.status).toBe("CANCELLED");
  });

  it("keeps the order items table consistent with the order", async () => {
    const { orderId } = await pendingPayment();
    expect(await db.select().from(orderItems).where(eq(orderItems.orderId, orderId))).toHaveLength(1);
  });
});
