import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { listAdminProducts } from "@/server/admin";
import { requireAdmin } from "@/server/page";

export const metadata: Metadata = { title: "Admin products" };

export default async function AdminProducts() {
  await requireAdmin();
  const products = await listAdminProducts();

  return (
    <div className="container section stack">
      <div className="section-head">
        <h1>Products</h1>
        <Link href="/admin/products/new" className="btn btn-primary">New product</Link>
      </div>
      <div className="table-wrap">
        <table className="table">
          <caption className="visually-hidden">Product inventory</caption>
          <thead>
            <tr><th scope="col">Name</th><th scope="col">Category</th><th scope="col" className="right">Price</th><th scope="col" className="right">Stock</th><th scope="col">Status</th><th scope="col"><span className="visually-hidden">Actions</span></th></tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={product.id}>
                <td>{product.name}</td>
                <td>{product.categoryName}</td>
                <td className="right num">{formatMoney(product.priceCents)}</td>
                <td className="right num">{product.stock}</td>
                <td>{product.archivedAt ? <span className="badge">Archived</span> : <span className="badge badge-ok">Active</span>}</td>
                <td className="right"><Link href={`/admin/products/${product.id}`}>Edit<span className="visually-hidden"> {product.name}</span></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
