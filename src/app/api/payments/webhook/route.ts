import { api, json } from "@/server/http";
import { RATE_RULES } from "@/server/rate-limit";
import { handleWebhook, SIGNATURE_HEADER } from "@/server/payments/webhook";

// Authenticated by HMAC signature, not by cookie, so the same-origin check does not apply.
export const POST = api({ access: "public", rateLimit: RATE_RULES.webhook, originCheck: false }, async ({ req }) => {
  const result = await handleWebhook(await req.text(), req.headers.get(SIGNATURE_HEADER));
  return json({ received: true, ...result });
});
