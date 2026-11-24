import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/checkout-form";
import { Totals } from "@/components/order-summary";
import Image from "next/image";
import { formatMoney } from "@/lib/money";
import { getCart } from "@/server/cart";
import { requireUser } from "@/server/page";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const cart = await getCart(user.id);
  if (!cart.canCheckout) redirect("/cart");

  return (
    <div className="container section">
      <h1>Checkout</h1>
      <div className="two-col">
        <CheckoutForm defaultName={user.name} totalLabel={formatMoney(cart.totalCents)} />
        <aside className="summary stack" aria-label="Order summary">
          <h2>Your order</h2>
          <ul className="line-list">
            {cart.items.map((item) => (
              <li key={item.productId} className="line">
                <Image src={item.imageUrl} alt="" width={80} height={100} unoptimized />
                <div>
                  <p className="line-name">{item.name}</p>
                  <p className="muted small">Quantity {item.quantity}</p>
                </div>
                <p className="price">{formatMoney(item.lineTotalCents)}</p>
              </li>
            ))}
          </ul>
          <Totals subtotalCents={cart.subtotalCents} shippingCents={cart.shippingCents} totalCents={cart.totalCents} />
        </aside>
      </div>
    </div>
  );
}
