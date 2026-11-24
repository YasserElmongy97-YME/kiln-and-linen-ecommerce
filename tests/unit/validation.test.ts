import { describe, expect, it } from "vitest";
import { passesLuhn } from "@/lib/luhn";
import { slugify } from "@/lib/slug";
import {
  cartAddSchema,
  catalogQuerySchema,
  isFutureExpiry,
  paySchema,
  productInputSchema,
  registerSchema,
  shippingSchema,
} from "@/lib/validation";

const uuid = "5b6f2c0e-5d7a-4b0e-9a55-0b9c3a0f1c11";

describe("registerSchema", () => {
  it("normalises the email and accepts a strong password", () => {
    const parsed = registerSchema.parse({ name: " Mona ", email: " Mona@Example.COM ", password: "long-enough-pass" });
    expect(parsed).toEqual({ name: "Mona", email: "mona@example.com", password: "long-enough-pass" });
  });

  it("rejects short passwords and malformed emails", () => {
    expect(registerSchema.safeParse({ name: "Mona", email: "mona@example.com", password: "short" }).success).toBe(false);
    expect(registerSchema.safeParse({ name: "Mona", email: "not-an-email", password: "long-enough-pass" }).success).toBe(false);
  });
});

describe("cartAddSchema", () => {
  it("rejects zero, negative, fractional and oversized quantities", () => {
    for (const quantity of [0, -1, 1.5, 11, "2"]) {
      expect(cartAddSchema.safeParse({ productId: uuid, quantity }).success).toBe(false);
    }
    expect(cartAddSchema.safeParse({ productId: uuid, quantity: 3 }).success).toBe(true);
  });
});

describe("shippingSchema", () => {
  const valid = { name: "Mona Hassan", phone: "+20 100 123 4567", line1: "12 Corniche Road", city: "Hurghada", postalCode: "84511", country: "EG" };

  it("accepts a complete address", () => {
    expect(shippingSchema.safeParse(valid).success).toBe(true);
  });

  it("reports which field is wrong", () => {
    const result = shippingSchema.safeParse({ ...valid, phone: "abc", country: "ZZ" });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((i) => i.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["phone", "country"]));
  });
});

describe("card validation", () => {
  it("implements the Luhn check", () => {
    expect(passesLuhn("4242424242424242")).toBe(true);
    expect(passesLuhn("4242424242424241")).toBe(false);
    expect(passesLuhn("abcd")).toBe(false);
  });

  it("strips spaces from card numbers and rejects expired cards", () => {
    const base = { cardName: "Mona Hassan", cardNumber: "4242 4242 4242 4242", expiry: "12/99", cvc: "123" };
    expect(paySchema.parse(base).cardNumber).toBe("4242424242424242");
    expect(paySchema.safeParse({ ...base, expiry: "01/20" }).success).toBe(false);
    expect(paySchema.safeParse({ ...base, cvc: "12" }).success).toBe(false);
  });

  it("treats the current month as still valid", () => {
    expect(isFutureExpiry("06/30", new Date(2030, 5, 15))).toBe(true);
    expect(isFutureExpiry("05/30", new Date(2030, 5, 15))).toBe(false);
  });
});

describe("catalogQuerySchema", () => {
  it("applies defaults and coerces numbers", () => {
    expect(catalogQuerySchema.parse({})).toEqual({ sort: "newest", page: 1 });
    expect(catalogQuerySchema.parse({ minPrice: "10", page: "2" })).toMatchObject({ minPrice: 10, page: 2 });
  });

  it("rejects unknown sort values", () => {
    expect(catalogQuerySchema.safeParse({ sort: "random" }).success).toBe(false);
  });
});

describe("productInputSchema", () => {
  const valid = { name: "Mug", description: "A very nice mug.", priceCents: 2400, stock: 5, imageUrl: "/products/mug.svg", categoryId: uuid };

  it("accepts https URLs and site paths for images", () => {
    expect(productInputSchema.safeParse(valid).success).toBe(true);
    expect(productInputSchema.safeParse({ ...valid, imageUrl: "https://example.com/a.jpg" }).success).toBe(true);
  });

  it("rejects unsafe image URLs, zero prices and negative stock", () => {
    for (const bad of [{ imageUrl: "javascript:alert(1)" }, { imageUrl: "//evil.com/a.jpg" }, { imageUrl: "http://x.com/a.jpg" }, { priceCents: 0 }, { stock: -1 }, { priceCents: 19.99 }]) {
      expect(productInputSchema.safeParse({ ...valid, ...bad }).success).toBe(false);
    }
  });
});

describe("slugify", () => {
  it("builds url-safe slugs", () => {
    expect(slugify("  Kitchen & Table!  ")).toBe("kitchen-table");
  });
});
