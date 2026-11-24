import type { Metadata } from "next";
import Link from "next/link";
import { OrderItems, ShippingAddress, Totals } from "@/components/order-summary";
import { orderRef } from "@/lib/format";
import { getOrderDetail } from "@/server/orders";
import { orNotFound, requireUser } from "@/server/page";
import { requireUuidParam } from "@/server/http";

export const metadata: Metadata = { title: "Order confirmation" };

export default async function ConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}/confirmation`);
  const order = await orNotFound(getOrderDetail(requireUuidParam(id, "Order"), { userId: user.id }));
  const paid = order.status !== "PENDING_PAYMENT" && order.status !== "CANCELLED";

  return (
    <div className="container section stack">
      {paid ? (
        <>
          <h1>Thank you, your order is confirmed</h1>
          <p className="alert alert-ok" role="status">
            Order {orderRef(order.id)} is paid (sandbox payment, no real charge). We will update its status as it is packed and shipped.
          </p>
        </>
      ) : (
        <>
          <h1>This order is not paid yet</h1>
          <p className="alert alert-warn">Order {orderRef(order.id)} is {order.status === "CANCELLED" ? "cancelled" : "waiting for payment"}.</p>
          {order.status === "PENDING_PAYMENT" && <Link href={`/orders/${order.id}`} className="btn btn-primary">Complete payment</Link>}
        </>
      )}
      <div className="two-col">
        <section className="stack" aria-labelledby="items-title">
          <h2 id="items-title">What you ordered</h2>
          <OrderItems items={order.items} />
        </section>
        <aside className="summary stack">
          <h2>Totals</h2>
          <Totals subtotalCents={order.subtotalCents} shippingCents={order.shippingCents} totalCents={order.totalCents} />
          <h3>Delivering to</h3>
          <ShippingAddress order={order} />
        </aside>
      </div>
      <div className="actions">
        <Link href={`/orders/${order.id}`} className="btn btn-primary">View order details</Link>
        <Link href="/products" className="btn">Keep shopping</Link>
      </div>
    </div>
  );
}
