import type { Metadata } from "next";
import Link from "next/link";
import { OrderItems, PaymentHistory, ShippingAddress, Totals } from "@/components/order-summary";
import { PayForm } from "@/components/pay-form";
import { OrderStatusBadge } from "@/components/status-badge";
import { formatDate, orderRef } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { getOrderDetail } from "@/server/orders";
import { orNotFound, requireUser } from "@/server/page";
import { requireUuidParam } from "@/server/http";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Order details" };

export default async function OrderPage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}`);
  const order = await orNotFound(getOrderDetail(requireUuidParam(id, "Order"), { userId: user.id }));
  const lastFailure = order.payments[0]?.status === "FAILED" ? order.payments[0].failureReason : null;

  return (
    <div className="container section stack">
      <p className="small"><Link href="/orders">All orders</Link></p>
      <div className="section-head">
        <h1>Order {orderRef(order.id)}</h1>
        <OrderStatusBadge status={order.status} />
      </div>
      <p className="muted">Placed {formatDate(order.createdAt)}</p>

      {order.status === "PENDING_PAYMENT" && (
        <section className="panel stack" aria-labelledby="pay-title">
          <h2 id="pay-title">Complete your payment</h2>
          {lastFailure && <p className="alert alert-error" role="alert">Your last payment failed: {lastFailure}. Your items are reserved while you try again.</p>}
          <PayForm orderId={order.id} totalLabel={formatMoney(order.totalCents)} />
        </section>
      )}

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
