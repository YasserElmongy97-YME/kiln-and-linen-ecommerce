import type { Metadata } from "next";
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import { requireUser } from "@/server/page";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser("/account");
  return (
    <div className="container section narrow stack">
      <h1>Your account</h1>
      <dl className="kv kv-left">
        <dt>Name</dt><dd>{user.name}</dd>
        <dt>Email</dt><dd>{user.email}</dd>
        <dt>Role</dt><dd>{user.role === "ADMIN" ? "Administrator" : "Customer"}</dd>
      </dl>
      <div className="actions">
        <Link href="/orders" className="btn btn-primary">View your orders</Link>
        {user.role === "ADMIN" && <Link href="/admin" className="btn">Open admin</Link>}
        <LogoutButton />
      </div>
    </div>
  );
}
