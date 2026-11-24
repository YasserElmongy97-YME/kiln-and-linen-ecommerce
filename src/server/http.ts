import { z } from "zod";
import { AppError } from "@/lib/errors";
import { getEnv } from "@/lib/env";
import { enforceRateLimit, type RateRule } from "./rate-limit";
import { getUserBySessionToken, readCookie, SESSION_COOKIE, type SessionUser } from "./session";

type Access = "public" | "user" | "admin";
type UserFor<A extends Access> = A extends "public" ? SessionUser | null : SessionUser;

interface RouteContext {
  params: Promise<Record<string, string>>;
}

interface Options<A extends Access> {
  access: A;
  rateLimit?: RateRule;
  /** Same-origin check for cookie-authenticated mutations. Disabled for signed webhooks. */
  originCheck?: boolean;
}

interface HandlerArgs<A extends Access> {
  req: Request;
  user: UserFor<A>;
  params: Record<string, string>;
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) =>
  Response.json(data, { status, headers });

function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;
  const allowed = new Set([new URL(getEnv().APP_URL).origin, new URL(req.url).origin]);
  if (!allowed.has(origin)) throw new AppError(403, "BAD_ORIGIN", "Cross-origin request rejected");
}

/** Maps each failing field (dotted path for nested objects) to its messages. */
function fieldErrors(error: z.ZodError): Record<string, string[]> {
  const byField: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const field = issue.path.join(".") || "_";
    (byField[field] ??= []).push(issue.message);
  }
  return byField;
}

export async function parseJson<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Send application/json");
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body is not valid JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new AppError(400, "VALIDATION_ERROR", "Some fields are invalid", fieldErrors(result.error));
  }
  return result.data;
}

function toErrorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return json({ error: { code: error.code, message: error.message, details: error.details } }, error.status);
  }
  console.error("Unhandled API error:", error);
  return json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on our side" } }, 500);
}

/** Wraps a route handler with authentication, authorization, same-origin and rate-limit checks. */
export function api<A extends Access>(options: Options<A>, handler: (args: HandlerArgs<A>) => Promise<Response>) {
  return async (req: Request, context: RouteContext): Promise<Response> => {
    try {
      if (options.rateLimit) enforceRateLimit(options.rateLimit, clientIp(req));
      if (req.method !== "GET" && options.originCheck !== false) assertSameOrigin(req);

      const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
      const user = await getUserBySessionToken(token);
      if (options.access !== "public" && !user) throw new AppError(401, "UNAUTHENTICATED", "Sign in to continue");
      if (options.access === "admin" && user?.role !== "ADMIN") {
        throw new AppError(403, "FORBIDDEN", "You do not have access to this resource");
      }
      const params = await context.params;
      return await handler({ req, user: user as UserFor<A>, params });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function requireIdempotencyKey(req: Request): string {
  const parsed = z.string().trim().min(8).max(100).safeParse(req.headers.get("idempotency-key"));
  if (!parsed.success) throw new AppError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
  return parsed.data;
}

export function requireUuidParam(value: string | undefined, label = "id"): string {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw new AppError(404, "NOT_FOUND", `${label} not found`);
  return parsed.data;
}
