import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { orders, payments } from "@/db/schema";
import { conflict, notFound } from "@/lib/errors";
import type { PayInput } from "@/lib/validation";
import { getPaymentProvider, newEventId, newReference } from "./provider";
import { handleWebhook, signPayload } from "./webhook";

async function loadPayment(idempotencyKey: string) {
  const [payment] = await db.select().from(payments).where(eq(payments.idempotencyKey, idempotencyKey));
  return payment;
}

/**
 * Charges the order through the configured provider. The amount always comes from the stored order.
 * The provider outcome is delivered as a signed event through the same webhook handler a real provider would call.
 */
export async function payOrder(input: { userId: string; orderId: string; card: PayInput; idempotencyKey: string }) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.userId, input.userId)));
  if (!order) throw notFound("Order");

  const repeated = await loadPayment(input.idempotencyKey);
  if (repeated) {
    if (repeated.orderId !== order.id) throw conflict("This idempotency key was used for another order");
    return repeated;
  }
  if (order.status !== "PENDING_PAYMENT") throw conflict("This order is not awaiting payment");

  const provider = getPaymentProvider();
  const reference = newReference();
  const [created] = await db
    .insert(payments)
    .values({
      orderId: order.id,
      provider: provider.name,
      reference,
      idempotencyKey: input.idempotencyKey,
      amountCents: order.totalCents,
      cardLast4: input.card.cardNumber.slice(-4),
    })
    .onConflictDoNothing({ target: payments.idempotencyKey })
    .returning();
  if (!created) return (await loadPayment(input.idempotencyKey))!;

  const result = await provider.charge({
    reference,
    amountCents: order.totalCents,
    card: { number: input.card.cardNumber, expiry: input.card.expiry, cvc: input.card.cvc },
  });
  const rawEvent = JSON.stringify({
    id: newEventId(),
    type: result.status === "SUCCEEDED" ? "payment.succeeded" : "payment.failed",
    reference,
    amountCents: order.totalCents,
    failureReason: result.failureReason,
  });
  await handleWebhook(rawEvent, signPayload(rawEvent));
  return (await loadPayment(input.idempotencyKey))!;
}

export const toPublicPayment = (payment: typeof payments.$inferSelect) => ({
  id: payment.id,
  orderId: payment.orderId,
  reference: payment.reference,
  provider: payment.provider,
  status: payment.status,
  amountCents: payment.amountCents,
  cardLast4: payment.cardLast4,
  failureReason: payment.failureReason,
});
