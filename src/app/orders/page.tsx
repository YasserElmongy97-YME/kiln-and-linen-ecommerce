import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusBadge, PaymentStatusBadge } from "@/components/status-badge";
import { formatDate, orderRef } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { PaymentStatus } from "@/lib/states";
import { listOrders } from "@/server/orders";
import { requireUser } from "@/server/page";

export const metadata: Metadata = { title: "Your orders" };

export default async function OrdersPage() {
  const user = await requireUser("/orders");
  const orders = await listOrders({ userId: user.id });

  return (
    <div className="container section">
      <h1>Your orders</h1>
      {orders.length === 0 ? (
        <div className="empty">
          <p className="muted">You have not placed an order yet.</p>
          <Link href="/products" className="btn btn-primary">Start shopping</Link>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <caption className="visually-hidden">Order history</caption>
            <thead>
              <tr><th scope="col">Order</th><th scope="col">Placed</th><th scope="col">Items</th><th scope="col">Status</th><th scope="col">Payment</th><th scope="col" className="right">Total</th></tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td><Link href={`/orders/${order.id}`}>{orderRef(order.id)}</Link></td>
                  <td className="small">{formatDate(order.createdAt)}</td>
                  <td className="num">{order.itemCount}</td>
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
