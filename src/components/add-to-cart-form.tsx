"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ApiError, apiRequest } from "@/lib/client/api";
import { MAX_LINE_QUANTITY } from "@/lib/pricing";
import { FormMessage } from "./fields";

interface Props {
  productId: string;
  slug: string;
  stock: number;
  signedIn: boolean;
}

export function AddToCartForm({ productId, slug, stock, signedIn }: Props) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const [pending, startTransition] = useTransition();
  const max = Math.min(stock, MAX_LINE_QUANTITY);

  if (stock === 0) return <p className="alert alert-error">This item is sold out.</p>;

  function submit() {
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/products/${slug}`)}`);
      return;
    }
    setError(null);
    setAdded(false);
    startTransition(async () => {
      try {
        await apiRequest("/api/cart/items", { body: { productId, quantity } });
        setAdded(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Could not add this item. Try again.");
      }
    });
  }

  return (
    <div className="stack">
      <div className="buy-row">
        <div className="stepper" role="group" aria-label="Quantity">
          <button type="button" onClick={() => setQuantity((q) => q - 1)} disabled={quantity <= 1} aria-label="Decrease quantity">−</button>
          <output aria-live="polite">{quantity}</output>
          <button type="button" onClick={() => setQuantity((q) => q + 1)} disabled={quantity >= max} aria-label="Increase quantity">+</button>
        </div>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={pending}>
          {pending ? "Adding…" : signedIn ? "Add to cart" : "Sign in to add to cart"}
        </button>
      </div>
      <FormMessage message={error} />
      <div role="status">{added && <p className="alert alert-ok">Added to your cart. <a href="/cart">View cart</a></p>}</div>
    </div>
  );
}
