import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { safeReturnPath } from "@/lib/client/api";
import { getCurrentUser } from "@/server/page";

export const metadata: Metadata = { title: "Create account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeReturnPath(next, "/account"));
  return (
    <div className="container section narrow">
      <h1>Create your account</h1>
      <AuthForm mode="register" next={next} />
    </div>
  );
}
