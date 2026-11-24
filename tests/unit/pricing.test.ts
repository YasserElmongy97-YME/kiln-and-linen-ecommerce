import { describe, expect, it } from "vitest";
import { calculateTotals, FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_FLAT_CENTS } from "@/lib/pricing";
import { centsToDollars, dollarsToCents, formatMoney } from "@/lib/money";

describe("calculateTotals", () => {
  it("returns zeros for an empty cart", () => {
    expect(calculateTotals([])).toEqual({ subtotalCents: 0, shippingCents: 0, totalCents: 0 });
  });

  it("sums unit price times quantity and adds flat shipping below the threshold", () => {
    const totals = calculateTotals([
      { unitPriceCents: 2400, quantity: 2 },
      { unitPriceCents: 1999, quantity: 1 },
    ]);
    expect(totals.subtotalCents).toBe(6799);
    expect(totals.shippingCents).toBe(SHIPPING_FLAT_CENTS);
    expect(totals.totalCents).toBe(6799 + SHIPPING_FLAT_CENTS);
  });

  it("makes shipping free exactly at the threshold", () => {
    expect(calculateTotals([{ unitPriceCents: FREE_SHIPPING_THRESHOLD_CENTS, quantity: 1 }]).shippingCents).toBe(0);
    expect(calculateTotals([{ unitPriceCents: FREE_SHIPPING_THRESHOLD_CENTS - 1, quantity: 1 }]).shippingCents).toBe(SHIPPING_FLAT_CENTS);
  });

  it("stays exact with integer cents (no floating point drift)", () => {
    expect(calculateTotals([{ unitPriceCents: 1099, quantity: 3 }]).subtotalCents).toBe(3297);
  });
});

describe("formatMoney", () => {
  it("formats cents as dollars", () => {
    expect(formatMoney(145000)).toBe("$1,450.00");
    expect(formatMoney(5)).toBe("$0.05");
  });
});

describe("price input conversion", () => {
  it("converts entered prices to exact cents", () => {
    expect(dollarsToCents("24.50")).toBe(2450);
    expect(dollarsToCents("19.99")).toBe(1999);
    expect(dollarsToCents("7")).toBe(700);
    expect(centsToDollars(2450)).toBe("24.50");
  });

  it("rejects malformed prices", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1,50"]) expect(Number.isNaN(dollarsToCents(bad))).toBe(true);
  });
});
