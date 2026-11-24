export const SHIPPING_FLAT_CENTS = 900;
export const FREE_SHIPPING_THRESHOLD_CENTS = 12000;
export const MAX_LINE_QUANTITY = 10;

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
}

export interface Totals {
  subtotalCents: number;
  shippingCents: number;
  totalCents: number;
}

/** Single source of truth for cart, checkout and order totals. All amounts are integer cents. */
export function calculateTotals(lines: PricedLine[]): Totals {
  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const shippingCents =
    subtotalCents === 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS ? 0 : SHIPPING_FLAT_CENTS;
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
