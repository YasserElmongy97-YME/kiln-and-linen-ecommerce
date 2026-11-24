import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusControl } from "@/components/admin/order-status-control";
import { OrderItems, PaymentHistory, ShippingAddress, Totals } from "@/components/order-summary";
import { OrderStatusBadge } from "@/components/status-badge";
import { formatDate, orderRef } from "@/lib/format";
import { nextOrderStatuses } from "@/lib/states";
import { requireUuidParam } from "@/server/http";
import { getOrderDetail } from "@/server/orders";
import { orNotFound, requireAdmin } from "@/server/page";

export const metadata: Metadata = { title: "Admin order" };

const ACTION_LABELS: Record<string, string> = {
  PROCESSING: "Mark as processing",
  SHIPPED: "Mark as shipped",
  DELIVERED: "Mark as delivered",
  CANCELLED: "Cancel order",
};

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const order = await orNotFound(getOrderDetail(requireUuidParam(id, "Order")));
  const actions = nextOrderStatuses(order.status).map((status) => ({ status, label: ACTION_LABELS[status] ?? status }));

  return (
    <div className="container section stack">
      <p className="small"><Link href="/admin/orders">All orders</Link></p>
      <div className="section-head">
        <h1>Order {orderRef(order.id)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="muted">{order.customerName} ({order.customerEmail}), placed {formatDate(order.createdAt)}</p>

      <section className="panel stack" aria-labelledby="status-title">
        <h2 id="status-title">Update status</h2>
        {order.status === "PENDING_PAYMENT" && <p className="small muted">Only a confirmed payment can mark an order as paid. You can still cancel it.</p>}
        <OrderStatusControl orderId={order.id} actions={actions} />
      </section>

      <div className="two-col">
        <section className="stack" aria-labelledby="items-title">
          <h2 id="items-title">Items</h2>
          <OrderItems items={order.items} />
        </section>
        <aside className="summary stack">
          <h2>Totals</h2>
          <Totals subtotalCents={order.subtotalCents} shippingCents={order.shippingCents} totalCents={order.totalCents} />
          <h3>Delivering to</h3>
          <ShippingAddress order={order} />
        </aside>
      </div>
      <section className="stack" aria-labelledby="payments-title">
        <h2 id="payments-title">Payments</h2>
        <PaymentHistory payments={order.payments} />
      </section>
    </div>
  );
}
