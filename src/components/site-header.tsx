import Link from "next/link";
import { getCartCount } from "@/server/cart";
import { getCurrentUser } from "@/server/page";

export async function SiteHeader() {
  const user = await getCurrentUser();
  const cartCount = user ? await getCartCount(user.id) : 0;

  return (
    <header className="site-header">
      <p className="sandbox-bar">
        Payment sandbox: no real money moves. Use test card 4242 4242 4242 4242 at checkout.
      </p>
      <div className="container header-row">
        <Link href="/" className="brand">Kiln &amp; Linen</Link>
        <nav aria-label="Main" className="main-nav">
          <Link href="/products">Shop</Link>
          {user?.role === "ADMIN" && <Link href="/admin">Admin</Link>}
          {user ? <Link href="/account">Account</Link> : <Link href="/login">Sign in</Link>}
          <Link href="/cart">
            Cart<span className="cart-count" aria-label={`${cartCount} items in cart`}>{cartCount}</span>
          </Link>
        </nav>
        <form action="/products" role="search" className="header-search">
          <label htmlFor="header-search" className="visually-hidden">Search products</label>
          <input id="header-search" className="input" type="search" name="q" placeholder="Search the shop" maxLength={80} />
        </form>
      </div>
    </header>
  );
}
