import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section empty">
      <h1>We could not find that page</h1>
      <p className="muted">The link may be old, or the item may no longer be for sale.</p>
      <Link href="/products" className="btn btn-primary">Back to the shop</Link>
    </div>
  );
}
