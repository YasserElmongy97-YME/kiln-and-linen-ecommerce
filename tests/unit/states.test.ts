import { describe, expect, it } from "vitest";
import { canAdminSetOrderStatus, canTransitionOrder, canTransitionPayment, nextOrderStatuses } from "@/lib/states";

describe("order transitions", () => {
  it("allows the normal fulfilment path", () => {
    expect(canTransitionOrder("PENDING_PAYMENT", "PAID")).toBe(true);
    expect(canTransitionOrder("PAID", "PROCESSING")).toBe(true);
    expect(canTransitionOrder("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransitionOrder("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("blocks skipping steps and leaving terminal states", () => {
    expect(canTransitionOrder("PAID", "DELIVERED")).toBe(false);
    expect(canTransitionOrder("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransitionOrder("CANCELLED", "PAID")).toBe(false);
    expect(canTransitionOrder("SHIPPED", "CANCELLED")).toBe(false);
  });

  it("never lets an admin mark an order PAID", () => {
    expect(canAdminSetOrderStatus("PENDING_PAYMENT", "PAID")).toBe(false);
    expect(canAdminSetOrderStatus("PENDING_PAYMENT", "PROCESSING")).toBe(false);
    expect(canAdminSetOrderStatus("PAID", "PROCESSING")).toBe(true);
  });

  it("lists the next actions an admin can take", () => {
    expect(nextOrderStatuses("PAID")).toEqual(["PROCESSING", "CANCELLED"]);
    expect(nextOrderStatuses("DELIVERED")).toEqual([]);
  });
});

describe("payment transitions", () => {
  it("only moves forward from PENDING", () => {
    expect(canTransitionPayment("PENDING", "SUCCEEDED")).toBe(true);
    expect(canTransitionPayment("PENDING", "FAILED")).toBe(true);
    expect(canTransitionPayment("PENDING", "REFUNDED")).toBe(false);
  });

  it("treats FAILED and REFUNDED as final and refunds only succeeded payments", () => {
    expect(canTransitionPayment("SUCCEEDED", "REFUNDED")).toBe(true);
    expect(canTransitionPayment("FAILED", "SUCCEEDED")).toBe(false);
    expect(canTransitionPayment("SUCCEEDED", "FAILED")).toBe(false);
    expect(canTransitionPayment("REFUNDED", "SUCCEEDED")).toBe(false);
  });
});
