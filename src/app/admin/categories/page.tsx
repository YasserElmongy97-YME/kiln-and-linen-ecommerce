import type { Metadata } from "next";
import { CategoryManager } from "@/components/admin/category-manager";
import { listCategoriesWithCounts } from "@/server/admin";
import { requireAdmin } from "@/server/page";

export const metadata: Metadata = { title: "Admin categories" };

export default async function AdminCategories() {
  await requireAdmin();
  return (
    <div className="container section narrow stack">
      <h1>Categories</h1>
      <CategoryManager categories={await listCategoriesWithCounts()} />
    </div>
  );
}
