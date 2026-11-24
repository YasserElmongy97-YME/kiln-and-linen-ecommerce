import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };

afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe("payment safety", () => {
  it("defaults to the sandbox provider, which moves no money", async () => {
    delete process.env.PAYMENT_PROVIDER;
    const { getPaymentProvider } = await import("@/server/payments/provider");
    const provider = getPaymentProvider();
    expect(provider.name).toBe("sandbox");
    const result = await provider.charge({ reference: "sbx_x", amountCents: 100, card: { number: "4111111111111111", expiry: "12/99", cvc: "123" } });
    expect(result.status).toBe("FAILED");
  });

  it("refuses to start with any provider other than sandbox", async () => {
    for (const value of ["stripe", "live", "production"]) {
      process.env.PAYMENT_PROVIDER = value;
      vi.resetModules();
      const { getPaymentProvider } = await import("@/server/payments/provider");
      expect(() => getPaymentProvider()).toThrow(/PAYMENT_PROVIDER/);
    }
  });

  it("refuses to start without a webhook secret of reasonable length", async () => {
    process.env.PAYMENT_WEBHOOK_SECRET = "short";
    const { getEnv } = await import("@/lib/env");
    expect(() => getEnv()).toThrow(/PAYMENT_WEBHOOK_SECRET/);
  });

  it("does not leak configuration values in the error message", async () => {
    process.env.PAYMENT_PROVIDER = "stripe-secret-value";
    const { getEnv } = await import("@/lib/env");
    try {
      getEnv();
    } catch (error) {
      expect(String(error)).not.toContain("stripe-secret-value");
    }
  });
});
