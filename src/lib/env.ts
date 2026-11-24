import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PAYMENT_PROVIDER: z.literal("sandbox").default("sandbox"),
  PAYMENT_WEBHOOK_SECRET: z.string().min(16),
  APP_URL: z.url().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Validated environment. Throws naming the invalid keys (never their values). */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const keys = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Invalid environment configuration: ${keys}`);
  }
  cached = parsed.data;
  return cached;
}
