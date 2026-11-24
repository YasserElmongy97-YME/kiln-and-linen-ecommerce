"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/client/api";
import { submitPayment } from "@/lib/client/payment";
import { CardFields, readCard } from "./card-fields";
import { FormMessage } from "./fields";

export function PayForm({ orderId, totalLabel }: { orderId: string; totalLabel: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setErrors({});
    setMessage(null);
    try {
      const payment = await submitPayment(orderId, readCard(event.currentTarget));
      if (payment.status === "SUCCEEDED") {
        router.push(`/orders/${orderId}/confirmation`);
      } else {
        setMessage(`${payment.failureReason ?? "Payment failed"}. Try another test card.`);
        setPending(false);
      }
      router.refresh();
    } catch (e) {
      setErrors(e instanceof ApiError ? e.fieldErrors : {});
      setMessage(e instanceof ApiError && Object.keys(e.fieldErrors).length === 0 ? e.message : "Check the highlighted fields.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack" noValidate>
      <CardFields errors={errors} />
      <FormMessage message={message} />
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Processing payment…" : `Pay ${totalLabel} (test mode)`}</button>
    </form>
  );
}
