import type { OrderStatus, PaymentStatus } from "@/lib/states";

const ORDER_LABELS: Record<OrderStatus, [label: string, tone: string]> = {
  PENDING_PAYMENT: ["Awaiting payment", "badge-warn"],
  PAID: ["Paid", "badge-ok"],
  PROCESSING: ["Processing", "badge-ok"],
  SHIPPED: ["Shipped", "badge-ok"],
  DELIVERED: ["Delivered", "badge-ok"],
  CANCELLED: ["Cancelled", "badge-danger"],
};

const PAYMENT_LABELS: Record<PaymentStatus, [label: string, tone: string]> = {
  PENDING: ["Payment pending", "badge-warn"],
  SUCCEEDED: ["Payment received", "badge-ok"],
  FAILED: ["Payment failed", "badge-danger"],
  REFUNDED: ["Refunded", "badge"],
};

export const orderStatusLabel = (status: OrderStatus) => ORDER_LABELS[status][0];

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const [label, tone] = ORDER_LABELS[status];
  return <span className={`badge ${tone}`}>{label}</span>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus | null }) {
  if (!status) return <span className="badge">No payment yet</span>;
  const [label, tone] = PAYMENT_LABELS[status];
  return <span className={`badge ${tone}`}>{label}</span>;
}
