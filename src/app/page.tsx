import Image from "next/image";
import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import { formatMoney } from "@/lib/money";
import { listCategories, listProducts } from "@/server/catalog";

export default async function HomePage() {
  const [{ items }, categories] = await Promise.all([listProducts({ sort: "newest", page: 1 }), listCategories()]);
  const featured = items.find((item) => item.stock > 0) ?? items[0];
  const arrivals = items.filter((item) => item.id !== featured?.id).slice(0, 6);

  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <h1>Objects for a slower table.</h1>
          <p className="lead">
            Ceramics, lighting, linen and tableware from small workshops, chosen to be used every day and to look better for it.
          </p>
          <Link href="/products" className="btn btn-primary">Shop the collection</Link>
        </div>
        {featured && (
          <Link href={`/products/${featured.slug}`} className="hero-feature">
            <Image src={featured.imageUrl} alt={featured.name} width={800} height={1000} priority unoptimized />
            <span className="hero-caption">
              <span>{featured.name}</span>
              <span className="price">{formatMoney(featured.priceCents)}</span>
            </span>
          </Link>
        )}
      </section>

      <section className="container section" aria-labelledby="categories-title">
        <h2 id="categories-title">Shop by room</h2>
        <ul className="category-index">
          {categories.map((category) => (
            <li key={category.id}>
              <Link href={`/products?category=${category.slug}`}>{category.name}</Link>
            </li>
          ))}
        </ul>
      </section>

      {arrivals.length > 0 && (
        <section className="container section" aria-labelledby="arrivals-title">
          <div className="section-head">
            <h2 id="arrivals-title">New on the shelves</h2>
            <Link href="/products">See everything</Link>
          </div>
          <div className="staggered-grid">
            {arrivals.map((product) => <ProductTile key={product.id} product={product} />)}
          </div>
        </section>
      )}
    </>
  );
}
