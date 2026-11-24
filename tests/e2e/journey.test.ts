import { beforeAll, describe, expect, it } from "vitest";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3100";
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";
const PASSWORD = "e2e-password-1234";

const SHIPPING = { name: "Mona Hassan", phone: "+20 100 123 4567", line1: "12 Corniche Road", city: "Hurghada", postalCode: "84511", country: "EG" };
const GOOD_CARD = { cardName: "Mona Hassan", cardNumber: "4242 4242 4242 4242", expiry: "12/99", cvc: "123" };
const DECLINED_CARD = { ...GOOD_CARD, cardNumber: "4000 0000 0000 0002" };

/** A tiny browser stand-in: keeps cookies, never follows redirects automatically. */
class Session {
  private cookie = "";

  async request(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const headers: Record<string, string> = { ...init.headers };
    if (this.cookie) headers.cookie = this.cookie;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    const res = await fetch(`${BASE}${path}`, {
      method: init.method ?? (init.body === undefined ? "GET" : "POST"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      redirect: "manual",
    });
    const set = res.headers.getSetCookie().find((c) => c.startsWith("sid="));
    if (set) this.cookie = set.split(";")[0]!.endsWith("=") ? "" : set.split(";")[0]!;
    return res;
  }

  async page(path: string) {
    const res = await this.request(path);
    // React inserts comment nodes between adjacent text fragments; strip them so text assertions read naturally.
    return { status: res.status, location: res.headers.get("location"), html: (await res.text()).replaceAll("<!-- -->", "") };
  }

  async api(path: string, init: { method?: string; body?: unknown; headers?: Record<string, string> } = {}) {
    const res = await this.request(path, init);
    return { status: res.status, body: await res.json().catch(() => null) };
  }
}

const key = () => crypto.randomUUID();
const position = (html: string, text: string) => html.indexOf(text);

let customer: Session;
let mugId: string;
let boardId: string;

beforeAll(async () => {
  const anonymous = new Session();
  const idOf = async (slug: string) => (await anonymous.api(`/api/products/${slug}`)).body?.product?.id as string;
  mugId = await idOf("stoneware-mug");
  boardId = await idOf("oak-cutting-board");
  expect(mugId && boardId, "run `npm run db:seed` before the e2e suite").toBeTruthy();
});

describe("storefront (signed out)", () => {
  const visitor = new Session();

  it("renders the home page with the brand and a featured product", async () => {
    const { status, html } = await visitor.page("/");
    expect(status).toBe(200);
    expect(html).toContain("Objects for a slower table.");
    expect(html).toContain("Shop the collection");
  });

  it("lists products and searches by name", async () => {
    const all = await visitor.page("/products");
    expect((all.html.match(/class="product-tile"/g) ?? []).length).toBe(9);
    expect(all.html).toContain("Page 1 of 2");
    expect((await visitor.page("/products?q=mug")).html).toContain("Stoneware Mug");
    const search = await visitor.page("/products?q=vase");
    expect(search.html).toContain("Fluted Vase");
    expect(search.html).not.toContain("Stoneware Mug");
  });

  it("filters by category and price and sorts", async () => {
    const lighting = await visitor.page("/products?category=lighting&sort=price-desc");
    expect(lighting.html).toContain("Arc Table Lamp");
    expect(lighting.html).not.toContain("Stoneware Mug");
    expect(position(lighting.html, "Arc Table Lamp")).toBeLessThan(position(lighting.html, "Brass Candle Holder"));
    const cheap = await visitor.page("/products?maxPrice=30");
    expect(cheap.html).toContain("Stoneware Mug");
    expect(cheap.html).not.toContain("Arc Table Lamp");
  });

  it("shows an empty state when nothing matches", async () => {
    const { html } = await visitor.page("/products?q=zzzzzz");
    expect(html).toContain("Nothing matches yet");
  });

  it("opens a product page and shows stock", async () => {
    const { status, html } = await visitor.page("/products/stoneware-mug");
    expect(status).toBe(200);
    expect(html).toContain("Stoneware Mug");
    expect(html).toContain("Sign in to add to cart");
    expect((await visitor.page("/products/does-not-exist")).status).toBe(404);
  });

  it("sends signed-out visitors to sign in for protected pages", async () => {
    for (const path of ["/cart", "/checkout", "/orders", "/account", "/admin", "/admin/products"]) {
      const res = await visitor.page(path);
      expect(res.status, path).toBe(307);
      expect(res.location).toContain("/login");
    }
  });
});

describe("customer journey", () => {
  let orderId: string;

  beforeAll(async () => {
    customer = new Session();
    const res = await customer.api("/api/auth/register", { body: { name: "Mona Hassan", email: `mona+${Date.now()}@example.com`, password: PASSWORD } });
    expect(res.status).toBe(201);
  });

  it("adds to the cart, changes quantity and shows the cart page", async () => {
    expect((await customer.api("/api/cart/items", { body: { productId: mugId, quantity: 1 } })).status).toBe(201);
    const updated = await customer.api(`/api/cart/items/${mugId}`, { method: "PATCH", body: { quantity: 2 } });
    expect(updated.body).toMatchObject({ itemCount: 2, subtotalCents: 4800, shippingCents: 900, totalCents: 5700 });
    const { html } = await customer.page("/cart");
    expect(html).toContain("Your cart");
    expect(html).toContain("Stoneware Mug");
    expect(html).toContain("Go to checkout");
  });

  it("rejects invalid checkout data and does not create an order", async () => {
    const res = await customer.api("/api/checkout", { body: { shipping: { ...SHIPPING, phone: "x" } }, headers: { "idempotency-key": key() } });
    expect(res.status).toBe(400);
    expect(res.body.error.details["shipping.phone"]).toBeDefined();
    expect((await customer.api("/api/orders")).body.orders).toHaveLength(0);
  });

  it("renders the checkout page", async () => {
    const { status, html } = await customer.page("/checkout");
    expect(status).toBe(200);
    expect(html).toContain("Delivery");
    expect(html).toContain("sandbox");
  });

  it("places the order and survives a declined sandbox payment", async () => {
    const placed = await customer.api("/api/checkout", { body: { shipping: SHIPPING }, headers: { "idempotency-key": key() } });
    expect(placed.status).toBe(201);
    orderId = placed.body.orderId;

    const declined = await customer.api(`/api/orders/${orderId}/pay`, { body: DECLINED_CARD, headers: { "idempotency-key": key() } });
    expect(declined.body.payment.status).toBe("FAILED");

    const { html } = await customer.page(`/orders/${orderId}`);
    expect(html).toContain("Complete your payment");
    expect(html).toContain("Your card was declined");
  });

  it("completes payment with the test card and shows the confirmation", async () => {
    const paid = await customer.api(`/api/orders/${orderId}/pay`, { body: GOOD_CARD, headers: { "idempotency-key": key() } });
    expect(paid.body.payment).toMatchObject({ status: "SUCCEEDED", amountCents: 5700 });

    const confirmation = await customer.page(`/orders/${orderId}/confirmation`);
    expect(confirmation.status).toBe(200);
    expect(confirmation.html).toContain("your order is confirmed");
    expect(confirmation.html).toContain("Stoneware Mug");
  });

  it("lists the order in history with its statuses", async () => {
    const history = await customer.page("/orders");
    expect(history.html).toContain(`#${orderId.slice(0, 8).toUpperCase()}`);
    expect(history.html).toContain("Paid");
    const detail = await customer.page(`/orders/${orderId}`);
    expect(detail.html).toContain("Payment received");
    expect(detail.html).toContain("Payment failed");
  });

  it("refuses a second payment on a paid order", async () => {
    const again = await customer.api(`/api/orders/${orderId}/pay`, { body: GOOD_CARD, headers: { "idempotency-key": key() } });
    expect(again.status).toBe(409);
  });

  it("blocks adding more than the available stock", async () => {
    const stock = (await customer.api("/api/products?q=cutting")).body.items[0].stock as number;
    const tooMany = await customer.api("/api/cart/items", { body: { productId: boardId, quantity: Math.min(stock + 1, 10) } });
    expect(tooMany.status).toBe(stock + 1 > 10 ? 400 : 409);
  });

  it("keeps other customers out of this order and out of admin", async () => {
    const other = new Session();
    await other.api("/api/auth/register", { body: { name: "Other Person", email: `other+${Date.now()}@example.com`, password: PASSWORD } });
    expect((await other.page(`/orders/${orderId}`)).status).toBe(404);
    expect((await other.api(`/api/orders/${orderId}`)).status).toBe(404);
    expect((await other.page("/admin")).status).toBe(404);
    expect((await other.api("/api/admin/orders")).status).toBe(403);
    expect((await other.api("/api/admin/products", { body: { name: "Hack" } })).status).toBe(403);
    expect((await customer.api("/api/admin/orders")).status).toBe(403);
  });

  it("signs out and loses access", async () => {
    await customer.api("/api/auth/logout", { method: "POST", body: {} });
    expect((await customer.page("/orders")).status).toBe(307);
  });
});

describe.skipIf(!ADMIN_EMAIL)("admin journey", () => {
  const admin = new Session();

  beforeAll(async () => {
    expect((await admin.api("/api/auth/login", { body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } })).status).toBe(200);
  });

  it("opens the admin pages", async () => {
    for (const path of ["/admin", "/admin/products", "/admin/products/new", "/admin/categories", "/admin/orders"]) {
      const res = await admin.page(path);
      expect(res.status, path).toBe(200);
    }
  });

  it("creates, edits and archives a product that appears in the shop", async () => {
    const categories = (await admin.api("/api/admin/categories")).body.categories as { id: string }[];
    const name = `E2E Tumbler ${Date.now()}`;
    const created = await admin.api("/api/admin/products", { body: { name, description: "Created by the e2e suite.", priceCents: 1500, stock: 4, imageUrl: "/products/glass-carafe-set.svg", categoryId: categories[0]!.id } });
    expect(created.status).toBe(201);
    const id = created.body.product.id as string;

    const slug = created.body.product.slug as string;
    const listed = (query: string) => new Session().page(`/products?q=${encodeURIComponent(query)}`).then((r) => r.html.includes(`href="/products/${slug}"`));
    expect(await listed(name)).toBe(true);
    expect((await admin.api(`/api/admin/products/${id}`, { method: "PATCH", body: { priceCents: 1800, stock: 9 } })).body.product).toMatchObject({ priceCents: 1800, stock: 9 });
    expect((await admin.page(`/admin/products/${id}`)).status).toBe(200);

    await admin.api(`/api/admin/products/${id}`, { method: "DELETE" });
    expect(await listed(name)).toBe(false);
  });

  it("sees customer orders and moves a paid order through fulfilment", async () => {
    const list = (await admin.api("/api/admin/orders?status=PAID")).body.orders as { id: string }[];
    expect(list.length).toBeGreaterThan(0);
    const id = list[0]!.id;
    expect((await admin.page(`/admin/orders/${id}`)).html).toContain("Update status");
    expect((await admin.api(`/api/admin/orders/${id}`, { method: "PATCH", body: { status: "PROCESSING" } })).body.order.status).toBe("PROCESSING");
    expect((await admin.api(`/api/admin/orders/${id}`, { method: "PATCH", body: { status: "PAID" } })).status).toBe(400);
  });
});
