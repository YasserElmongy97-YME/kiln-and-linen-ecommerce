import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { payments, products } from "@/db/schema";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as addItem } from "@/app/api/cart/items/route";
import { POST as checkout } from "@/app/api/checkout/route";
import { POST as pay } from "@/app/api/orders/[id]/pay/route";
import { DELETE as deleteCategory, PATCH as renameCategory } from "@/app/api/admin/categories/[id]/route";
import { GET as listCategories, POST as createCategory } from "@/app/api/admin/categories/route";
import { GET as adminGetOrder, PATCH as adminPatchOrder } from "@/app/api/admin/orders/[id]/route";
import { GET as adminListOrders } from "@/app/api/admin/orders/route";
import { DELETE as archiveProduct, GET as adminGetProduct, PATCH as patchProduct } from "@/app/api/admin/products/[id]/route";
import { GET as adminListProducts, POST as createProduct } from "@/app/api/admin/products/route";
import { GET as publicProducts } from "@/app/api/products/route";
import { call, CARDS, createCatalog, createUser, PASSWORD, resetDb, SHIPPING } from "../helpers";

let catalog: Awaited<ReturnType<typeof createCatalog>>;
let admin: string;
let customer: string;

async function signIn(email: string, role: "CUSTOMER" | "ADMIN"): Promise<string> {
  await createUser(email, role);
  const res = await call(login, "/api/auth/login", { body: { email, password: PASSWORD } });
  return res.setCookie!.split(";")[0]!;
}

beforeEach(async () => {
  await resetDb();
  catalog = await createCatalog();
  admin = await signIn("admin@example.com", "ADMIN");
  customer = await signIn("mona@example.com", "CUSTOMER");
});

async function paidOrder(quantity = 2): Promise<string> {
  await call(addItem, "/api/cart/items", { cookie: customer, body: { productId: catalog.products["stoneware-mug"]!.id, quantity } });
  const order = await call(checkout, "/api/checkout", { cookie: customer, headers: { "idempotency-key": `key-${Math.random()}-abcdef` }, body: { shipping: SHIPPING } });
  const orderId = order.body.orderId as string;
  await call(pay, `/api/orders/${orderId}/pay`, { cookie: customer, params: { id: orderId }, headers: { "idempotency-key": `pay-${Math.random()}-abcdef` }, body: CARDS.success });
  return orderId;
}

const setStatus = (cookie: string | undefined, orderId: string, status: string) =>
  call(adminPatchOrder, `/api/admin/orders/${orderId}`, { method: "PATCH", cookie, params: { id: orderId }, body: { status } });

describe("permission separation", () => {
  const uuid = "5b6f2c0e-5d7a-4b0e-9a55-0b9c3a0f1c11";
  const endpoints = [
    { name: "list products", run: (c?: string) => call(adminListProducts, "/api/admin/products", { cookie: c }) },
    { name: "create product", run: (c?: string) => call(createProduct, "/api/admin/products", { cookie: c, body: { name: "X Mug", description: "A fine mug indeed.", priceCents: 100, stock: 1, imageUrl: "/a.svg", categoryId: uuid } }) },
    { name: "get product", run: (c?: string) => call(adminGetProduct, `/api/admin/products/${uuid}`, { cookie: c, params: { id: uuid } }) },
    { name: "patch product", run: (c?: string) => call(patchProduct, `/api/admin/products/${uuid}`, { method: "PATCH", cookie: c, params: { id: uuid }, body: { stock: 1 } }) },
    { name: "archive product", run: (c?: string) => call(archiveProduct, `/api/admin/products/${uuid}`, { method: "DELETE", cookie: c, params: { id: uuid } }) },
    { name: "list categories", run: (c?: string) => call(listCategories, "/api/admin/categories", { cookie: c }) },
    { name: "create category", run: (c?: string) => call(createCategory, "/api/admin/categories", { cookie: c, body: { name: "Rugs" } }) },
    { name: "rename category", run: (c?: string) => call(renameCategory, `/api/admin/categories/${uuid}`, { method: "PATCH", cookie: c, params: { id: uuid }, body: { name: "Rugs" } }) },
    { name: "delete category", run: (c?: string) => call(deleteCategory, `/api/admin/categories/${uuid}`, { method: "DELETE", cookie: c, params: { id: uuid } }) },
    { name: "list orders", run: (c?: string) => call(adminListOrders, "/api/admin/orders", { cookie: c }) },
    { name: "get order", run: (c?: string) => call(adminGetOrder, `/api/admin/orders/${uuid}`, { cookie: c, params: { id: uuid } }) },
    { name: "update order status", run: (c?: string) => setStatus(c, uuid, "PROCESSING") },
  ];

  for (const endpoint of endpoints) {
    it(`blocks anonymous and customer access to: ${endpoint.name}`, async () => {
      expect((await endpoint.run(undefined)).status).toBe(401);
      const asCustomer = await endpoint.run(customer);
      expect(asCustomer.status).toBe(403);
      expect(JSON.stringify(asCustomer.body)).not.toMatch(/stack|sql|drizzle/i);
    });
  }

  it("ignores a client-side role claim in the request", async () => {
    const res = await call(adminListProducts, "/api/admin/products", { cookie: customer, headers: { "x-role": "ADMIN" } });
    expect(res.status).toBe(403);
  });

  it("does not change data when a customer attempts a write", async () => {
    await call(patchProduct, `/api/admin/products/${catalog.products["stoneware-mug"]!.id}`, {
      method: "PATCH", cookie: customer, params: { id: catalog.products["stoneware-mug"]!.id }, body: { priceCents: 1 },
    });
    expect((await db.select().from(products).where(eq(products.slug, "stoneware-mug")))[0]!.priceCents).toBe(2400);
  });
});

describe("admin product management", () => {
  it("creates, edits, restocks and archives products", async () => {
    const created = await call(createProduct, "/api/admin/products", {
      cookie: admin,
      body: { name: "Ribbed Tumbler", description: "A ribbed glass tumbler.", priceCents: 1800, stock: 7, imageUrl: "/products/glass-carafe-set.svg", categoryId: catalog.ceramics.id },
    });
    expect(created.status).toBe(201);
    expect(created.body.product.slug).toBe("ribbed-tumbler");
    const id = created.body.product.id as string;

    const edited = await call(patchProduct, `/api/admin/products/${id}`, { method: "PATCH", cookie: admin, params: { id }, body: { priceCents: 2000, stock: 12 } });
    expect(edited.body.product).toMatchObject({ priceCents: 2000, stock: 12 });

    expect((await call(publicProducts, "/api/products", { query: { q: "tumbler" } })).body.total).toBe(1);
    const archived = await call(archiveProduct, `/api/admin/products/${id}`, { method: "DELETE", cookie: admin, params: { id } });
    expect(archived.body.product.archivedAt).not.toBeNull();
    expect((await call(publicProducts, "/api/products", { query: { q: "tumbler" } })).body.total).toBe(0);
    expect((await call(adminListProducts, "/api/admin/products", { cookie: admin })).body.products.some((p: { id: string }) => p.id === id)).toBe(true);

    const restored = await call(patchProduct, `/api/admin/products/${id}`, { method: "PATCH", cookie: admin, params: { id }, body: { archived: false } });
    expect(restored.body.product.archivedAt).toBeNull();
  });

  it("generates unique slugs for duplicate names", async () => {
    const body = { name: "Stoneware Mug", description: "Another mug entirely.", priceCents: 2000, stock: 1, imageUrl: "/a.svg", categoryId: catalog.ceramics.id };
    expect((await call(createProduct, "/api/admin/products", { cookie: admin, body })).body.product.slug).toBe("stoneware-mug-2");
  });

  it("validates input", async () => {
    const res = await call(createProduct, "/api/admin/products", { cookie: admin, body: { name: "X", description: "short", priceCents: -5, stock: 1.5, imageUrl: "javascript:alert(1)", categoryId: "nope" } });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details).length).toBeGreaterThanOrEqual(5);
  });

  it("returns 404 for an unknown category on create", async () => {
    const res = await call(createProduct, "/api/admin/products", {
      cookie: admin,
      body: { name: "Ghost Mug", description: "No category exists.", priceCents: 100, stock: 1, imageUrl: "/a.svg", categoryId: "5b6f2c0e-5d7a-4b0e-9a55-0b9c3a0f1c11" },
    });
    expect(res.status).toBe(404);
  });
});

describe("admin categories", () => {
  it("creates, renames and deletes empty categories but protects used ones", async () => {
    const created = await call(createCategory, "/api/admin/categories", { cookie: admin, body: { name: "Rugs" } });
    expect(created.status).toBe(201);
    const id = created.body.category.id as string;
    expect((await call(createCategory, "/api/admin/categories", { cookie: admin, body: { name: "Rugs" } })).status).toBe(409);
    expect((await call(renameCategory, `/api/admin/categories/${id}`, { method: "PATCH", cookie: admin, params: { id }, body: { name: "Floor Rugs" } })).body.category.name).toBe("Floor Rugs");
    expect((await call(deleteCategory, `/api/admin/categories/${id}`, { method: "DELETE", cookie: admin, params: { id } })).status).toBe(200);

    const used = catalog.ceramics.id;
    expect((await call(deleteCategory, `/api/admin/categories/${used}`, { method: "DELETE", cookie: admin, params: { id: used } })).status).toBe(409);
    const listed = await call(listCategories, "/api/admin/categories", { cookie: admin });
    expect(listed.body.categories.find((c: { id: string }) => c.id === used).productCount).toBe(2);
  });
});

describe("admin order management", () => {
  it("shows any customer's order with payment status to admins", async () => {
    const orderId = await paidOrder();
    const detail = await call(adminGetOrder, `/api/admin/orders/${orderId}`, { cookie: admin, params: { id: orderId } });
    expect(detail.body.order).toMatchObject({ status: "PAID", customerEmail: "mona@example.com" });
    expect(detail.body.order.payments[0].status).toBe("SUCCEEDED");
    const list = await call(adminListOrders, "/api/admin/orders", { cookie: admin, query: { status: "PAID" } });
    expect(list.body.orders).toHaveLength(1);
    expect(list.body.orders[0].paymentStatus).toBe("SUCCEEDED");
  });

  it("moves an order through fulfilment and rejects invalid transitions", async () => {
    const orderId = await paidOrder();
    expect((await setStatus(admin, orderId, "DELIVERED")).status).toBe(409);
    expect((await setStatus(admin, orderId, "PAID")).status).toBe(400);
    expect((await setStatus(admin, orderId, "PROCESSING")).body.order.status).toBe("PROCESSING");
    expect((await setStatus(admin, orderId, "SHIPPED")).body.order.status).toBe("SHIPPED");
    expect((await setStatus(admin, orderId, "DELIVERED")).body.order.status).toBe("DELIVERED");
    expect((await setStatus(admin, orderId, "CANCELLED")).status).toBe(409);
  });

  it("cannot mark an unpaid order as processing", async () => {
    await call(addItem, "/api/cart/items", { cookie: customer, body: { productId: catalog.products["stoneware-mug"]!.id, quantity: 1 } });
    const order = await call(checkout, "/api/checkout", { cookie: customer, headers: { "idempotency-key": "unpaid-key-12345" }, body: { shipping: SHIPPING } });
    expect((await setStatus(admin, order.body.orderId, "PROCESSING")).status).toBe(409);
  });

  it("cancelling restores stock and refunds the payment", async () => {
    const orderId = await paidOrder(3);
    expect((await db.select().from(products).where(eq(products.slug, "stoneware-mug")))[0]!.stock).toBe(7);
    const res = await setStatus(admin, orderId, "CANCELLED");
    expect(res.body.order.status).toBe("CANCELLED");
    expect((await db.select().from(products).where(eq(products.slug, "stoneware-mug")))[0]!.stock).toBe(10);
    expect((await db.select().from(payments))[0]!.status).toBe("REFUNDED");
  });
});

describe("dashboard data", () => {
  it("exposes dashboard figures through the service layer", async () => {
    await paidOrder();
    const { getDashboard } = await import("@/server/admin");
    const dashboard = await getDashboard();
    expect(dashboard).toMatchObject({ revenueCents: 5700, activeProducts: 4, ordersByStatus: { PAID: 1 } });
    // Lowest stock first: Paper Pendant (0), Fluted Vase (3), Arc Table Lamp (5).
    expect(dashboard.lowStock.map((p) => p.name)).toEqual(["Paper Pendant", "Fluted Vase", "Arc Table Lamp"]);
  });
});
