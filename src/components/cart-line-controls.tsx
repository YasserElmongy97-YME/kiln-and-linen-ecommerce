"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, apiRequest } from "@/lib/client/api";
import { MAX_LINE_QUANTITY } from "@/lib/pricing";
import { FormMessage } from "./fields";

interface Props {
  productId: string;
  productName: string;
  quantity: number;
  stock: number;
}

export function CartLineControls({ productId, productName, quantity, stock }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const max = Math.min(stock, MAX_LINE_QUANTITY);

  function run(request: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await request();
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not update your cart.");
      }
    });
  }

  const setQuantity = (next: number) =>
    run(() => apiRequest(`/api/cart/items/${productId}`, { method: "PATCH", body: { quantity: next } }));
  const remove = () => run(() => apiRequest(`/api/cart/items/${productId}`, { method: "DELETE" }));

  return (
    <div className="cart-controls">
      <div className="stepper" role="group" aria-label={`Quantity of ${productName}`}>
        <button type="button" onClick={() => setQuantity(quantity - 1)} disabled={pending || quantity <= 1} aria-label={`Decrease quantity of ${productName}`}>−</button>
        <output aria-live="polite">{quantity}</output>
        <button type="button" onClick={() => setQuantity(quantity + 1)} disabled={pending || quantity >= max} aria-label={`Increase quantity of ${productName}`}>+</button>
      </div>
      <button type="button" className="link-button small" onClick={remove} disabled={pending}>
        Remove<span className="visually-hidden"> {productName}</span>
      </button>
      <FormMessage message={error} />
    </div>
  );
}
