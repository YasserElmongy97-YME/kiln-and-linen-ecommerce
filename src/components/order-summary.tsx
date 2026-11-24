import Image from "next/image";
import { COUNTRIES } from "@/lib/countries";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import type { OrderDetail } from "@/server/orders";
import { PaymentStatusBadge } from "./status-badge";

export function OrderItems({ items }: { items: OrderDetail["items"] }) {
  return (
    <ul className="line-list">
      {items.map((item) => (
        <li key={item.id} className="line">
          <Image src={item.imageUrl} alt="" width={80} height={100} unoptimized />
          <div>
            <p className="line-name">{item.productName}</p>
            <p className="muted small">{item.quantity} × {formatMoney(item.unitPriceCents)}</p>
          </div>
          <p className="price">{formatMoney(item.unitPriceCents * item.quantity)}</p>
        </li>
      ))}
    </ul>
  );
}

export function Totals({ subtotalCents, shippingCents, totalCents }: { subtotalCents: number; shippingCents: number; totalCents: number }) {
  return (
    <dl className="kv">
      <dt>Subtotal</dt><dd>{formatMoney(subtotalCents)}</dd>
      <dt>Shipping</dt><dd>{shippingCents === 0 ? "Free" : formatMoney(shippingCents)}</dd>
      <dt className="total">Total</dt><dd className="total">{formatMoney(totalCents)}</dd>
    </dl>
  );
}

export function ShippingAddress({ order }: { order: OrderDetail }) {
  const country = COUNTRIES.find((c) => c.code === order.shippingCountry)?.name ?? order.shippingCountry;
  return (
    <address className="address">
      {order.shippingName}<br />
      {order.shippingLine1}<br />
      {order.shippingCity} {order.shippingPostalCode}<br />
      {country}<br />
      {order.shippingPhone}
    </address>
  );
}

export function PaymentHistory({ payments }: { payments: OrderDetail["payments"] }) {
  if (payments.length === 0) return <p className="muted">No payment attempts yet.</p>;
  return (
    <div className="table-wrap">
      <table className="table">
        <caption className="visually-hidden">Payment attempts</caption>
        <thead>
          <tr><th scope="col">Reference</th><th scope="col">Status</th><th scope="col">Card</th><th scope="col">When</th><th scope="col" className="right">Amount</th></tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id}>
              <td className="num">{payment.reference}</td>
              <td>
                <PaymentStatusBadge status={payment.status} />
                {payment.failureReason && <span className="muted small"> {payment.failureReason}</span>}
              </td>
              <td className="num">{payment.cardLast4 ? `•••• ${payment.cardLast4}` : "n/a"}</td>
              <td className="small">{formatDate(payment.createdAt)}</td>
              <td className="right num">{formatMoney(payment.amountCents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
