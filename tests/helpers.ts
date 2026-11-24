import { sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, products, users } from "@/db/schema";
import { hashPassword } from "@/server/auth";
import { resetRateLimits } from "@/server/rate-limit";

type RouteContext = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: RouteContext) => Promise<Response>;

export const emptyContext: RouteContext = { params: Promise.resolve({}) };

interface CallOptions {
  method?: string;
  body?: unknown;
  cookie?: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  query?: Record<string, string>;
}

export interface ApiResult {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test helper returns loosely shaped JSON
  body: any;
  setCookie: string | null;
}

export async function call(handler: Handler, path: string, options: CallOptions = {}): Promise<ApiResult> {
  const url = new URL(`http://localhost:3000${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.cookie) headers.cookie = options.cookie;
  const req = new Request(url, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const res = await handler(req, { params: Promise.resolve(options.params ?? {}) });
  return { status: res.status, body: await res.json().catch(() => null), setCookie: res.headers.get("set-cookie") };
}

export async function resetDb(): Promise<void> {
  resetRateLimits();
  await db.execute(sql`truncate table payments, order_items, orders, cart_items, carts, sessions, products, categories, users restart identity cascade`);
}

export async function createCatalog() {
  const [ceramics, lighting] = await db
    .insert(categories)
    .values([
      { name: "Ceramics", slug: "ceramics" },
      { name: "Lighting", slug: "lighting" },
    ])
    .returning();
  const rows = await db
    .insert(products)
    .values([
      { name: "Stoneware Mug", slug: "stoneware-mug", description: "A sturdy glazed mug for coffee.", priceCents: 2400, stock: 10, imageUrl: "/products/stoneware-mug.svg", categoryId: ceramics!.id },
      { name: "Fluted Vase", slug: "fluted-vase", description: "A tall vase with vertical flutes.", priceCents: 6800, stock: 3, imageUrl: "/products/fluted-vase.svg", categoryId: ceramics!.id },
      { name: "Arc Table Lamp", slug: "arc-table-lamp", description: "Steel base with a linen drum shade.", priceCents: 14500, stock: 5, imageUrl: "/products/arc-table-lamp.svg", categoryId: lighting!.id },
      { name: "Paper Pendant", slug: "paper-pendant", description: "Washi paper dome pendant lamp.", priceCents: 9800, stock: 0, imageUrl: "/products/paper-pendant.svg", categoryId: lighting!.id },
    ])
    .returning();
  const bySlug = Object.fromEntries(rows.map((p) => [p.slug, p])) as Record<string, (typeof rows)[number]>;
  return { ceramics: ceramics!, lighting: lighting!, products: bySlug };
}

export async function createUser(email: string, role: "CUSTOMER" | "ADMIN" = "CUSTOMER") {
  const [user] = await db
    .insert(users)
    .values({ email, name: email.split("@")[0]!, role, passwordHash: await hashPassword("correct-horse-battery") })
    .returning();
  return user!;
}

export const PASSWORD = "correct-horse-battery";

export const SHIPPING = {
  name: "Mona Hassan",
  phone: "+20 100 123 4567",
  line1: "12 Corniche Road",
  city: "Hurghada",
  postalCode: "84511",
  country: "EG",
};

export const CARDS = {
  success: { cardName: "Mona Hassan", cardNumber: "4242 4242 4242 4242", expiry: "12/99", cvc: "123" },
  declined: { cardName: "Mona Hassan", cardNumber: "4000 0000 0000 0002", expiry: "12/99", cvc: "123" },
  insufficient: { cardName: "Mona Hassan", cardNumber: "4000000000009995", expiry: "12/99", cvc: "123" },
  realLooking: { cardName: "Mona Hassan", cardNumber: "4111111111111111", expiry: "12/99", cvc: "123" },
};
