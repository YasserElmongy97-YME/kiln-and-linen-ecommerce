import type { Metadata } from "next";
import Link from "next/link";
import { orderStatusLabel } from "@/components/status-badge";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES } from "@/lib/states";
import { getDashboard, LOW_STOCK_THRESHOLD } from "@/server/admin";
import { requireAdmin } from "@/server/page";

export const metadata: Metadata = { title: "Admin overview" };

export default async function AdminDashboard() {
  await requireAdmin();
  const dashboard = await getDashboard();

  return (
    <div className="container section stack">
      <h1>Overview</h1>
      <dl className="figures">
        <div><dt>Revenue (sandbox)</dt><dd>{formatMoney(dashboard.revenueCents)}</dd></div>
        <div><dt>Active products</dt><dd>{dashboard.activeProducts}</dd></div>
        <div><dt>Orders awaiting payment</dt><dd>{dashboard.ordersByStatus.PENDING_PAYMENT ?? 0}</dd></div>
        <div><dt>Orders to fulfil</dt><dd>{(dashboard.ordersByStatus.PAID ?? 0) + (dashboard.ordersByStatus.PROCESSING ?? 0)}</dd></div>
      </dl>

      <div className="two-col">
        <section className="stack" aria-labelledby="status-title">
          <h2 id="status-title">Orders by status</h2>
          <ul className="plain-list">
            {ORDER_STATUSES.map((status) => (
              <li key={status}>
                <Link href={`/admin/orders?status=${status}`}>{orderStatusLabel(status)}</Link>
                <span className="num">{dashboard.ordersByStatus[status] ?? 0}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="stack" aria-labelledby="stock-title">
          <h2 id="stock-title">Low stock (≤ {LOW_STOCK_THRESHOLD})</h2>
          {dashboard.lowStock.length === 0 ? (
            <p className="muted">Every active product is comfortably stocked.</p>
          ) : (
            <ul className="plain-list">
              {dashboard.lowStock.map((product) => (
                <li key={product.id}>
                  <Link href={`/admin/products/${product.id}`}>{product.name}</Link>
                  <span className="num">{product.stock === 0 ? "Sold out" : `${product.stock} left`}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
