import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AddToCartForm } from "@/components/add-to-cart-form";
import { StockBadge } from "@/components/product-tile";
import { formatMoney } from "@/lib/money";
import { FREE_SHIPPING_THRESHOLD_CENTS, SHIPPING_FLAT_CENTS } from "@/lib/pricing";
import { getProductBySlug } from "@/server/catalog";
import { getCurrentUser, orNotFound } from "@/server/page";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug).catch(() => null);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [product, user] = await Promise.all([orNotFound(getProductBySlug(slug)), getCurrentUser()]);

  return (
    <div className="container section product-page">
      <div className="product-media">
        <Image src={product.imageUrl} alt={product.name} width={800} height={1000} priority unoptimized />
      </div>
      <div className="product-info stack">
        <p className="small muted">
          <Link href="/products">Shop</Link> / <Link href={`/products?category=${product.categorySlug}`}>{product.categoryName}</Link>
        </p>
        <h1>{product.name}</h1>
        <p className="price price-large">{formatMoney(product.priceCents)}</p>
        <p>{product.description}</p>
        <div className="stock-line">
          {product.stock > 0 ? <span>In stock</span> : null}
          <StockBadge stock={product.stock} />
        </div>
        <AddToCartForm productId={product.id} slug={product.slug} stock={product.stock} signedIn={Boolean(user)} />
        <p className="small muted">
          Shipping is {formatMoney(SHIPPING_FLAT_CENTS)}, free on orders over {formatMoney(FREE_SHIPPING_THRESHOLD_CENTS)}.
        </p>
      </div>
    </div>
  );
}
