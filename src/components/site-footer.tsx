import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container footer-row">
        <p className="brand-small">Kiln &amp; Linen</p>
        <nav aria-label="Footer">
          <Link href="/products">Shop</Link>
          <Link href="/orders">Your orders</Link>
          <Link href="/account">Account</Link>
        </nav>
        <p className="small muted">
          This store runs in payment sandbox mode. Orders are real records; payments are simulated and no card is ever charged.
        </p>
      </div>
    </footer>
  );
}
