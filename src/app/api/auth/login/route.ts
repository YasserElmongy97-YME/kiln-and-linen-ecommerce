import { api, json, parseJson } from "@/server/http";
import { verifyLogin } from "@/server/auth";
import { RATE_RULES } from "@/server/rate-limit";
import { createSession, sessionCookieHeader } from "@/server/session";
import { loginSchema } from "@/lib/validation";

export const POST = api({ access: "public", rateLimit: RATE_RULES.auth }, async ({ req }) => {
  const { email, password } = await parseJson(req, loginSchema);
  const user = await verifyLogin(email, password);
  const { token, expiresAt } = await createSession(user.id);
  return json({ user }, 200, { "Set-Cookie": sessionCookieHeader(token, expiresAt) });
});
