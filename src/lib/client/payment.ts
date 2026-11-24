import { apiRequest, newIdempotencyKey } from "./api";

export interface PaymentResult {
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  failureReason: string | null;
}

/** One payment attempt: a fresh idempotency key per attempt, so retries after a decline are new charges. */
export async function submitPayment(orderId: string, card: Record<string, string>): Promise<PaymentResult> {
  const { payment } = await apiRequest<{ payment: PaymentResult }>(`/api/orders/${orderId}/pay`, {
    body: card,
    idempotencyKey: newIdempotencyKey(),
  });
  return payment;
}
