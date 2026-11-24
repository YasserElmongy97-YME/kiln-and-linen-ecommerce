import Image from "next/image";
import Link from "next/link";
import { formatMoney } from "@/lib/money";

interface Props {
  product: { slug: string; name: string; priceCents: number; stock: number; imageUrl: string; categoryName: string };
  priority?: boolean;
}

export function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <span className="badge badge-danger">Sold out</span>;
  if (stock <= 5) return <span className="badge badge-warn">Only {stock} left</span>;
  return null;
}

export function ProductTile({ product, priority = false }: Props) {
  return (
    <Link href={`/products/${product.slug}`} className="product-tile">
      <div className="media">
        <Image src={product.imageUrl} alt="" width={800} height={1000} sizes="(max-width: 700px) 50vw, 33vw" unoptimized priority={priority} />
        <StockBadge stock={product.stock} />
      </div>
      <h3>{product.name}</h3>
      <div className="meta">
        <span>{product.categoryName}</span>
        <span className="price">{formatMoney(product.priceCents)}</span>
      </div>
    </Link>
  );
}
