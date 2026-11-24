import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { products } from "@/db/schema";
import { GET as listProducts } from "@/app/api/products/route";
import { GET as getProduct } from "@/app/api/products/[slug]/route";
import { createCatalog, call, resetDb } from "../helpers";

beforeEach(async () => {
  await resetDb();
  await createCatalog();
});

const names = (body: { items: { name: string }[] }) => body.items.map((p) => p.name);

describe("product catalog API", () => {
  it("lists active products with category and stock", async () => {
    const res = await call(listProducts, "/api/products");
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items[0]).toMatchObject({ categoryName: expect.any(String), stock: expect.any(Number) });
  });

  it("searches by name, case-insensitively", async () => {
    expect(names((await call(listProducts, "/api/products", { query: { q: "MUG" } })).body)).toEqual(["Stoneware Mug"]);
  });

  it("treats LIKE wildcards in search as plain characters", async () => {
    expect((await call(listProducts, "/api/products", { query: { q: "%" } })).body.total).toBe(0);
  });

  it("filters by category and price range (in currency units)", async () => {
    expect((await call(listProducts, "/api/products", { query: { category: "lighting" } })).body.total).toBe(2);
    const range = await call(listProducts, "/api/products", { query: { minPrice: "50", maxPrice: "100" } });
    expect(names(range.body).sort()).toEqual(["Fluted Vase", "Paper Pendant"]);
  });

  it("sorts by price", async () => {
    expect(names((await call(listProducts, "/api/products", { query: { sort: "price-asc" } })).body)[0]).toBe("Stoneware Mug");
    expect(names((await call(listProducts, "/api/products", { query: { sort: "price-desc" } })).body)[0]).toBe("Arc Table Lamp");
  });

  it("paginates", async () => {
    const res = await call(listProducts, "/api/products", { query: { page: "2" } });
    expect(res.body).toMatchObject({ page: 2, pageCount: 1, items: [] });
  });

  it("rejects invalid filter values", async () => {
    expect((await call(listProducts, "/api/products", { query: { sort: "random" } })).status).toBe(400);
  });

  it("hides archived products everywhere", async () => {
    await db.update(products).set({ archivedAt: new Date() }).where(eq(products.slug, "stoneware-mug"));
    expect((await call(listProducts, "/api/products")).body.total).toBe(3);
    expect((await call(getProduct, "/api/products/stoneware-mug", { params: { slug: "stoneware-mug" } })).status).toBe(404);
  });

  it("returns one product by slug", async () => {
    const res = await call(getProduct, "/api/products/fluted-vase", { params: { slug: "fluted-vase" } });
    expect(res.body.product).toMatchObject({ name: "Fluted Vase", priceCents: 6800, stock: 3 });
  });
});
