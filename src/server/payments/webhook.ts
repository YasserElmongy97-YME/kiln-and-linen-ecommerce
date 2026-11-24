import { createHmac, timingSafeEqual } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { AppError, notFound } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { canTransitionOrder, canTransitionPayment } from "@/lib/states";
import { webhookEventSchema, type WebhookEvent } from "@/lib/validation";

export const SIGNATURE_HEADER = "x-signature";

export function signPayload(rawBody: string): string {
  return `sha256=${createHmac("sha256", getEnv().PAYMENT_WEBHOOK_SECRET).update(rawBody).digest("hex")}`;
}

export function isValidSignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;
  const expected = Buffer.from(signPayload(rawBody));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Verifies the HMAC signature, validates the event, then applies it. Replayed events are no-ops. */
export async function handleWebhook(rawBody: string, signature: string | null): Promise<{ applied: boolean }> {
  if (!isValidSignature(rawBody, signature)) throw new AppError(401, "INVALID_SIGNATURE", "Signature verification failed");
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  const event = webhookEventSchema.safeParse(parsed);
  if (!event.success) throw new AppError(400, "VALIDATION_ERROR", "Event payload is invalid");
  return applyPaymentEvent(event.data);
}

async function applyPaymentEvent(event: WebhookEvent): Promise<{ applied: boolean }> {
  return db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.reference, event.reference)).for("update");
    if (!payment) throw notFound("Payment");
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId)).for("update");
    if (!order) throw notFound("Order");

    if (payment.status !== "PENDING") return { applied: false };
    if (event.amountCents !== payment.amountCents || payment.amountCents !== order.totalCents) {
      throw new AppError(400, "AMOUNT_MISMATCH", "Event amount does not match the payment");
    }

    const now = new Date();
    if (event.type === "payment.failed") {
      await tx
        .update(payments)
        .set({ status: "FAILED", failureReason: event.failureReason ?? "Payment failed", updatedAt: now })
        .where(eq(payments.id, payment.id));
      return { applied: true };
    }

    const orderAwaitingPayment = order.status === "PENDING_PAYMENT" && canTransitionOrder(order.status, "PAID");
    if (orderAwaitingPayment && canTransitionPayment("PENDING", "SUCCEEDED")) {
      await tx.update(payments).set({ status: "SUCCEEDED", updatedAt: now }).where(eq(payments.id, payment.id));
      await tx.update(orders).set({ status: "PAID" }).where(and(eq(orders.id, order.id), eq(orders.status, "PENDING_PAYMENT")));
    } else {
      // The order was paid by another attempt or cancelled meanwhile: never keep a second charge.
      await tx
        .update(payments)
        .set({ status: "REFUNDED", failureReason: "Order no longer awaiting payment", updatedAt: now })
        .where(eq(payments.id, payment.id));
    }
    return { applied: true };
  });
}
