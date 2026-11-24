import type { Metadata } from "next";
import { ProductForm } from "@/components/admin/product-form";
import { getAdminProduct } from "@/server/admin";
import { requireUuidParam } from "@/server/http";
import { listCategories } from "@/server/catalog";
import { orNotFound, requireAdmin } from "@/server/page";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [product, categories] = await Promise.all([orNotFound(getAdminProduct(requireUuidParam(id, "Product"))), listCategories()]);

  return (
    <div className="container section narrow stack">
      <h1>{product.name}</h1>
      {product.archivedAt && <p className="alert alert-warn">This product is archived and hidden from the shop.</p>}
      <ProductForm categories={categories} product={{ ...product, archived: Boolean(product.archivedAt) }} />
    </div>
  );
}
