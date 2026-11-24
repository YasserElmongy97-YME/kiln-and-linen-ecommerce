import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeReturnPath } from "@/lib/client/api";
import { getCurrentUser } from "@/server/page";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeReturnPath(next, "/account"));
  return (
    <div className="container section narrow">
      <h1>Sign in</h1>
      <AuthForm mode="login" next={next} />
    </div>
  );
}
