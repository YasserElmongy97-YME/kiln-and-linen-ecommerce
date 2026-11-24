import { AppError } from "@/lib/errors";

export interface RateRule {
  name: string;
  limit: number;
  windowMs: number;
}

const hits = new Map<string, number[]>();

/** In-memory sliding window. Per-process: use a shared store (e.g. Redis) when running several instances. */
export function enforceRateLimit(rule: RateRule, clientKey: string): void {
  const now = Date.now();
  const key = `${rule.name}:${clientKey}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < rule.windowMs);
  if (recent.length >= rule.limit) {
    hits.set(key, recent);
    throw new AppError(429, "RATE_LIMITED", "Too many requests. Try again shortly.");
  }
  recent.push(now);
  hits.set(key, recent);
}

export function resetRateLimits(): void {
  hits.clear();
}

export const RATE_RULES = {
  auth: { name: "auth", limit: 10, windowMs: 60_000 },
  pay: { name: "pay", limit: 10, windowMs: 60_000 },
  webhook: { name: "webhook", limit: 120, windowMs: 60_000 },
  checkout: { name: "checkout", limit: 20, windowMs: 60_000 },
} satisfies Record<string, RateRule>;
