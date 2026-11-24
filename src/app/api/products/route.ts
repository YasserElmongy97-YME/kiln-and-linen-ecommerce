import { api, json } from "@/server/http";
import { AppError } from "@/lib/errors";
import { catalogQuerySchema } from "@/lib/validation";
import { listProducts } from "@/server/catalog";

export const GET = api({ access: "public" }, async ({ req }) => {
  const parsed = catalogQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) throw new AppError(400, "VALIDATION_ERROR", "Invalid filter parameters");
  return json(await listProducts(parsed.data));
});
