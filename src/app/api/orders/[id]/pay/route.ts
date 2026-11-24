import { api, json, parseJson, requireIdempotencyKey, requireUuidParam } from "@/server/http";
import { paySchema } from "@/lib/validation";
import { RATE_RULES } from "@/server/rate-limit";
import { payOrder, toPublicPayment } from "@/server/payments/service";

export const POST = api({ access: "user", rateLimit: RATE_RULES.pay }, async ({ req, user, params }) => {
  const idempotencyKey = requireIdempotencyKey(req);
  const card = await parseJson(req, paySchema);
  const payment = await payOrder({ userId: user.id, orderId: requireUuidParam(params.id, "Order"), card, idempotencyKey });
  return json({ payment: toPublicPayment(payment) });
});
