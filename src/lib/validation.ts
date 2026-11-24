import { z } from "zod";
import { COUNTRY_CODES } from "./countries";
import { passesLuhn } from "./luhn";
import { MAX_LINE_QUANTITY } from "./pricing";
import { ADMIN_SETTABLE_STATUSES } from "./states";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);

export const registerSchema = z.object({
  name: trimmed(2, 80),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z.string().min(10, "Use at least 10 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
});

const quantity = z.number().int().min(1).max(MAX_LINE_QUANTITY);

export const cartAddSchema = z.object({ productId: z.uuid(), quantity });
export const cartSetSchema = z.object({ quantity });

export const shippingSchema = z.object({
  name: trimmed(2, 80),
  phone: z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, "Enter a valid phone number"),
  line1: trimmed(5, 120),
  city: trimmed(2, 60),
  postalCode: trimmed(3, 12),
  country: z.enum(COUNTRY_CODES),
});
export type ShippingInput = z.infer<typeof shippingSchema>;

export const checkoutSchema = z.object({ shipping: shippingSchema });

const expiry = z.string().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, "Use MM/YY");

export const paySchema = z.object({
  cardName: trimmed(2, 80),
  cardNumber: z
    .string()
    .transform((value) => value.replace(/[\s-]/g, ""))
    .refine(passesLuhn, "Enter a valid card number"),
  expiry: expiry.refine(isFutureExpiry, "Card has expired"),
  cvc: z.string().regex(/^\d{3,4}$/, "Enter the 3 or 4 digit code"),
});
export type PayInput = z.infer<typeof paySchema>;

export function isFutureExpiry(value: string, now = new Date()): boolean {
  const [month, year] = value.split("/").map(Number) as [number, number];
  const endOfMonth = new Date(2000 + year, month, 1);
  return endOfMonth > now;
}

export const idempotencyKeySchema = z.string().trim().min(8).max(100);

export const catalogQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  category: z.string().trim().max(80).optional(),
  minPrice: z.coerce.number().min(0).max(100000).optional(),
  maxPrice: z.coerce.number().min(0).max(100000).optional(),
  sort: z.enum(["newest", "price-asc", "price-desc", "name"]).default("newest"),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;

export const productInputSchema = z.object({
  name: trimmed(2, 120),
  description: trimmed(10, 2000),
  priceCents: z.number().int().min(1).max(100_000_00),
  stock: z.number().int().min(0).max(100000),
  imageUrl: z.string().trim().max(500).refine(isSafeImageUrl, "Use an https URL or a /path from this site"),
  categoryId: z.uuid(),
});
export type ProductInput = z.infer<typeof productInputSchema>;
export const productPatchSchema = productInputSchema.partial().extend({ archived: z.boolean().optional() });

export const categoryInputSchema = z.object({ name: trimmed(2, 60) });

export const orderStatusSchema = z.object({ status: z.enum(ADMIN_SETTABLE_STATUSES) });

export const webhookEventSchema = z.object({
  id: z.string().min(8).max(100),
  type: z.enum(["payment.succeeded", "payment.failed"]),
  reference: z.string().min(8).max(100),
  amountCents: z.number().int().min(1),
  failureReason: z.string().max(200).optional(),
});
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

function isSafeImageUrl(value: string): boolean {
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  return z.url().safeParse(value).success && value.startsWith("https://");
}
