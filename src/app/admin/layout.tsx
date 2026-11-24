import type { ReactNode } from "react";
import Link from "next/link";
import { requireAdmin } from "@/server/page";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return (
    <>
      <div className="admin-bar">
        <nav className="container" aria-label="Admin">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/categories">Categories</Link>
          <Link href="/admin/orders">Orders</Link>
        </nav>
      </div>
      {children}
    </>
  );
}
