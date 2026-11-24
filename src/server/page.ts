import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppError } from "@/lib/errors";
import { getUserBySessionToken, SESSION_COOKIE, type SessionUser } from "./session";

export async function getCurrentUser(): Promise<SessionUser | null> {
  return getUserBySessionToken((await cookies()).get(SESSION_COOKIE)?.value);
}

export async function requireUser(returnTo: string): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(returnTo)}`);
  return user;
}

/** Non-admins get a 404 so the existence of admin pages is not revealed. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser("/admin");
  if (user.role !== "ADMIN") notFound();
  return user;
}

/** Turns a service-level 404 into the Next.js not-found page; other errors propagate. */
export async function orNotFound<T>(load: Promise<T>): Promise<T> {
  try {
    return await load;
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    throw error;
  }
}
