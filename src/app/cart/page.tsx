import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CartLineControls } from "@/components/cart-line-controls";
import { Totals } from "@/components/order-summary";
import { formatMoney } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD_CENTS } from "@/lib/pricing";
import { getCart } from "@/server/cart";
import { requireUser } from "@/server/page";

export const metadata: Metadata = { title: "Your cart" };

const ISSUE_TEXT = {
  UNAVAILABLE: "No longer available. Remove it to continue.",
  INSUFFICIENT_STOCK: "Not enough stock for this quantity. Lower it to continue.",
} as const;

export default async function CartPage() {
  const user = await requireUser("/cart");
  const cart = await getCart(user.id);

  if (cart.items.length === 0) {
    return (
      <div className="container section empty">
        <h1>Your cart is empty</h1>
        <p className="muted">Pick something from the shelves and it will wait for you here.</p>
        <Link href="/products" className="btn btn-primary">Browse the shop</Link>
      </div>
    );
  }

  const remaining = FREE_SHIPPING_THRESHOLD_CENTS - cart.subtotalCents;

  return (
    <div className="container section">
      <h1>Your cart</h1>
      <div className="two-col">
        <ul className="line-list">
          {cart.items.map((item) => (
            <li key={item.productId} className="line line-wide">
              <Image src={item.imageUrl} alt="" width={96} height={120} unoptimized />
              <div className="stack">
                <Link href={`/products/${item.slug}`} className="line-name">{item.name}</Link>
                <p className="muted small">{formatMoney(item.unitPriceCents)} each</p>
                {item.issue && <p className="alert alert-error small">{ISSUE_TEXT[item.issue]}</p>}
                <CartLineControls productId={item.productId} productName={item.name} quantity={item.quantity} stock={item.stock} />
              </div>
              <p className="price">{formatMoney(item.lineTotalCents)}</p>
            </li>
          ))}
        </ul>
        <aside className="summary stack" aria-label="Order summary">
          <h2>Summary</h2>
          <Totals subtotalCents={cart.subtotalCents} shippingCents={cart.shippingCents} totalCents={cart.totalCents} />
          {remaining > 0 && <p className="small muted">Add {formatMoney(remaining)} more for free shipping.</p>}
          {cart.canCheckout ? (
            <Link href="/checkout" className="btn btn-primary">Go to checkout</Link>
          ) : (
            <p className="alert alert-warn small">Fix the items marked above to check out.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
