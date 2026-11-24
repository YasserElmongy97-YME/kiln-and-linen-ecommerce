import { randomBytes } from "node:crypto";
import { getEnv } from "@/lib/env";

export interface CardDetails {
  number: string;
  expiry: string;
  cvc: string;
}

export interface ChargeRequest {
  reference: string;
  amountCents: number;
  card: CardDetails;
}

export interface ChargeResult {
  status: "SUCCEEDED" | "FAILED";
  failureReason?: string;
}

/**
 * Boundary for payment processors. A real provider (e.g. Stripe test mode) implements this
 * interface and emits events to the same webhook endpoint; checkout code does not change.
 */
export interface PaymentProvider {
  readonly name: string;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

const SANDBOX_CARDS: Record<string, ChargeResult> = {
  "4242424242424242": { status: "SUCCEEDED" },
  "4000000000000002": { status: "FAILED", failureReason: "Your card was declined" },
  "4000000000009995": { status: "FAILED", failureReason: "Your card has insufficient funds" },
};

/** Moves no money. Only the documented test card numbers can succeed. */
const sandboxProvider: PaymentProvider = {
  name: "sandbox",
  async charge({ card }) {
    return SANDBOX_CARDS[card.number] ?? { status: "FAILED", failureReason: "Sandbox mode accepts only test cards" };
  },
};

export function getPaymentProvider(): PaymentProvider {
  // getEnv() rejects every value except "sandbox", so a real charge cannot be configured by accident.
  getEnv();
  return sandboxProvider;
}

export const newReference = () => `sbx_${randomBytes(9).toString("hex")}`;
export const newEventId = () => `evt_${randomBytes(9).toString("hex")}`;
