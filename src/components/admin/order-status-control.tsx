"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, apiRequest } from "@/lib/client/api";
import { FormMessage } from "../fields";

interface Props {
  orderId: string;
  actions: { status: string; label: string }[];
}

export function OrderStatusControl({ orderId, actions }: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (actions.length === 0) return <p className="muted">No further status changes are available for this order.</p>;

  async function update(status: string, label: string) {
    if (status === "CANCELLED" && !window.confirm("Cancel this order? Stock is returned and any payment is refunded.")) return;
    setPending(true);
    setMessage(null);
    try {
      await apiRequest(`/api/admin/orders/${orderId}`, { method: "PATCH", body: { status } });
      router.refresh();
    } catch (e) {
      setMessage(e instanceof ApiError ? e.message : `Could not mark the order as ${label.toLowerCase()}.`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="stack">
      <div className="actions">
        {actions.map(({ status, label }) => (
          <button key={status} type="button" className={`btn ${status === "CANCELLED" ? "btn-danger" : "btn-primary"}`} disabled={pending} onClick={() => update(status, label)}>
            {label}
          </button>
        ))}
      </div>
      <FormMessage message={message} />
    </div>
  );
}
