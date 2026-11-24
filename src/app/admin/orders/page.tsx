import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge, orderStatusLabel, PaymentStatusBadge } from "@/components/status-badge";
import { formatDate, orderRef } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { ORDER_STATUSES, type PaymentStatus } from "@/lib/states";
import { listOrders } from "@/server/orders";
import { requireAdmin } from "@/server/page";

export const metadata: Metadata = { title: "Admin orders" };

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdmin();
  const { status } = await searchParams;
  const active = ORDER_STATUSES.find((s) => s === status);
  const orders = await listOrders({ status: active });

  return (
    <div className="container section stack">
      <h1>Orders</h1>
      <nav aria-label="Filter by status" className="filter-links">
        <Link href="/admin/orders" aria-current={active ? undefined : "page"}>All</Link>
        {ORDER_STATUSES.map((s) => (
          <Link key={s} href={`/admin/orders?status=${s}`} aria-current={active === s ? "page" : undefined}>{orderStatusLabel(s)}</Link>
        ))}
      </nav>
      {orders.length === 0 ? (
        <p className="muted">No orders match this filter.</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Orders</caption>
            <thead>
              <tr><th scope="col">Order</th><th scope="col">Customer</th><th scope="col">Placed</th><th scope="col">Status</th><th scope="col">Payment</th><th scope="col" className="right">Total</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/admin/orders/${order.id}`}>{orderRef(order.id)}</Link></td>
                  <td>{order.customerEmail}</td>
                  <td className="small">{formatDate(order.createdAt)}</td>
                  <td><OrderStatusBadge status={order.status} /></td>
                  <td><PaymentStatusBadge status={order.paymentStatus as PaymentStatus | null} /></td>
                  <td className="right num">{formatMoney(order.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
