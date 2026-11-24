import { beforeEach, describe, expect, it } from "vitest";
import { GET as getCart } from "@/app/api/cart/route";
import { POST as addItem } from "@/app/api/cart/items/route";
import { DELETE as removeItem, PATCH as setItem } from "@/app/api/cart/items/[productId]/route";
import { POST as login } from "@/app/api/auth/login/route";
import { call, createCatalog, createUser, PASSWORD, resetDb } from "../helpers";

let cookie: string;
let catalog: Awaited<ReturnType<typeof createCatalog>>;

beforeEach(async () => {
  await resetDb();
  catalog = await createCatalog();
  await createUser("mona@example.com");
  const res = await call(login, "/api/auth/login", { body: { email: "mona@example.com", password: PASSWORD } });
  cookie = res.setCookie!.split(";")[0]!;
});

const add = (productId: string, quantity: number) => call(addItem, "/api/cart/items", { cookie, body: { productId, quantity } });

describe("cart", () => {
  it("requires authentication", async () => {
    expect((await call(getCart, "/api/cart")).status).toBe(401);
    expect((await call(addItem, "/api/cart/items", { body: { productId: catalog.products["stoneware-mug"]!.id, quantity: 1 } })).status).toBe(401);
  });

  it("adds items, merges repeats and calculates totals on the server", async () => {
    const mug = catalog.products["stoneware-mug"]!;
    await add(mug.id, 2);
    const res = await add(mug.id, 1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body).toMatchObject({ itemCount: 3, subtotalCents: 7200, shippingCents: 900, totalCents: 8100, canCheckout: true });
  });

  it("grants free shipping once the subtotal passes the threshold", async () => {
    const res = await add(catalog.products["arc-table-lamp"]!.id, 1);
    expect(res.body).toMatchObject({ subtotalCents: 14500, shippingCents: 0, totalCents: 14500 });
  });

  it("rejects quantities above available stock", async () => {
    const vase = catalog.products["fluted-vase"]!;
    expect((await add(vase.id, 3)).status).toBe(201);
    const over = await add(vase.id, 1);
    expect(over.status).toBe(409);
    expect(over.body.error.message).toMatch(/Only 3/);
  });

  it("rejects out-of-stock products and invalid quantities", async () => {
    expect((await add(catalog.products["paper-pendant"]!.id, 1)).status).toBe(409);
    for (const quantity of [0, -2, 1.5, 11]) {
      expect((await add(catalog.products["stoneware-mug"]!.id, quantity)).status).toBe(400);
    }
    expect((await add("not-a-uuid", 1)).status).toBe(400);
  });

  it("updates and removes items", async () => {
    const mug = catalog.products["stoneware-mug"]!;
    await add(mug.id, 1);
    const updated = await call(setItem, `/api/cart/items/${mug.id}`, { method: "PATCH", cookie, params: { productId: mug.id }, body: { quantity: 4 } });
    expect(updated.body.items[0].quantity).toBe(4);
    const tooMany = await call(setItem, `/api/cart/items/${mug.id}`, { method: "PATCH", cookie, params: { productId: mug.id }, body: { quantity: 11 } });
    expect(tooMany.status).toBe(400);
    const removed = await call(removeItem, `/api/cart/items/${mug.id}`, { method: "DELETE", cookie, params: { productId: mug.id } });
    expect(removed.body).toMatchObject({ items: [], totalCents: 0, canCheckout: false });
  });

  it("flags items that became unavailable and blocks checkout", async () => {
    const vase = catalog.products["fluted-vase"]!;
    await add(vase.id, 3);
    const { db } = await import("@/db");
    const { products } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    await db.update(products).set({ stock: 1 }).where(eq(products.id, vase.id));
    const res = await call(getCart, "/api/cart", { cookie });
    expect(res.body.items[0].issue).toBe("INSUFFICIENT_STOCK");
    expect(res.body.canCheckout).toBe(false);
  });

  it("keeps carts separate per user", async () => {
    await add(catalog.products["stoneware-mug"]!.id, 1);
    await createUser("other@example.com");
    const other = await call(login, "/api/auth/login", { body: { email: "other@example.com", password: PASSWORD } });
    const res = await call(getCart, "/api/cart", { cookie: other.setCookie!.split(";")[0]! });
    expect(res.body.items).toEqual([]);
  });
});
