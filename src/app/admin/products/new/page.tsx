import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { listCategories } from "@/server/catalog";
import { requireAdmin } from "@/server/page";

export const metadata: Metadata = { title: "New product" };

export default async function NewProductPage() {
  await requireAdmin();
  const categories = await listCategories();
  return (
    <div className="container section narrow stack">
      <h1>New product</h1>
      {categories.length === 0
        ? <p className="alert alert-warn">Create a category first, then add products to it.</p>
        : <ProductForm categories={categories} />}
    </div>
  );
}
