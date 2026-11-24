import { api, json, parseJson } from "@/server/http";
import { registerUser } from "@/server/auth";
import { RATE_RULES } from "@/server/rate-limit";
import { createSession, sessionCookieHeader } from "@/server/session";
import { registerSchema } from "@/lib/validation";

export const POST = api({ access: "public", rateLimit: RATE_RULES.auth }, async ({ req }) => {
  const input = await parseJson(req, registerSchema);
  const user = await registerUser(input);
  const { token, expiresAt } = await createSession(user.id);
  return json({ user }, 201, { "Set-Cookie": sessionCookieHeader(token, expiresAt) });
});
