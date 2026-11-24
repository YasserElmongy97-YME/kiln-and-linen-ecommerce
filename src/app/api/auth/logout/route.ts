import { api, json } from "@/server/http";
import { clearedSessionCookieHeader, destroySession, readCookie, SESSION_COOKIE } from "@/server/session";

export const POST = api({ access: "public" }, async ({ req }) => {
  await destroySession(readCookie(req.headers.get("cookie"), SESSION_COOKIE));
  return json({ ok: true }, 200, { "Set-Cookie": clearedSessionCookieHeader() });
});
