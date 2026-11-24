const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function formatMoney(cents: number): string {
  return formatter.format(cents / 100);
}

export const centsToDollars = (cents: number): string => (cents / 100).toFixed(2);

/** Parses a user-entered price like "24.50" into integer cents; returns NaN when invalid. */
export function dollarsToCents(input: string): number {
  return /^\d+(\.\d{1,2})?$/.test(input.trim()) ? Math.round(Number(input) * 100) : Number.NaN;
}
