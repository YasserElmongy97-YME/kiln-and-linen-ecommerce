"use client";

export default function ProductsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container section empty" role="alert">
      <h1>We could not load the shop</h1>
      <p className="muted">Something went wrong on our side. Your cart is safe. Try again in a moment.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
