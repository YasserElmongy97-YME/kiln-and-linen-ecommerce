import { api, json, parseJson, requireIdempotencyKey } from "@/server/http";
import { checkoutSchema } from "@/lib/validation";
import { checkout } from "@/server/orders";
import { RATE_RULES } from "@/server/rate-limit";

export const POST = api({ access: "user", rateLimit: RATE_RULES.checkout }, async ({ req, user }) => {
  const idempotencyKey = requireIdempotencyKey(req);
  const { shipping } = await parseJson(req, checkoutSchema);
  const { orderId, created } = await checkout(user.id, shipping, idempotencyKey);
  return json({ orderId }, created ? 201 : 200);
});
