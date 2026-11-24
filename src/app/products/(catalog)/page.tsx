import type { Metadata } from "next";
import Link from "next/link";
import { ProductTile } from "@/components/product-tile";
import { catalogQuerySchema } from "@/lib/validation";
import { listCategories, listProducts } from "@/server/catalog";

export const metadata: Metadata = { title: "Shop" };

type SearchParams = Record<string, string | string[] | undefined>;

const SORTS = [
  ["newest", "Newest"],
  ["price-asc", "Price, low to high"],
  ["price-desc", "Price, high to low"],
  ["name", "Name"],
] as const;

const firstValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ProductsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, firstValue(value)]).filter(([, value]) => value !== undefined && value !== ""),
  );
  const parsed = catalogQuerySchema.safeParse(cleaned);
  const query = parsed.success ? parsed.data : catalogQuerySchema.parse({});
  const [result, categories] = await Promise.all([listProducts(query), listCategories()]);

  const pageHref = (page: number) => {
    const params = new URLSearchParams(Object.entries(cleaned).filter(([key]) => key !== "page") as [string, string][]);
    if (page > 1) params.set("page", String(page));
    const text = params.toString();
    return text ? `/products?${text}` : "/products";
  };
  const hasFilters = Object.keys(cleaned).some((key) => key !== "page");

  return (
    <div className="container section">
      <h1>{query.q ? `Results for “${query.q}”` : "The collection"}</h1>
      {!parsed.success && <p className="alert alert-warn">Some filters were not valid and were ignored.</p>}

      <div className="catalog">
        <details className="filters" open>
          <summary>Filter and sort</summary>
          <form action="/products" method="get" className="stack">
            <div className="field">
              <label htmlFor="q">Search</label>
              <input id="q" className="input" type="search" name="q" defaultValue={query.q} maxLength={80} />
            </div>
            <fieldset className="radio-list">
              <legend>Category</legend>
              <label><input type="radio" name="category" value="" defaultChecked={!query.category} /> All</label>
              {categories.map((category) => (
                <label key={category.id}>
                  <input type="radio" name="category" value={category.slug} defaultChecked={query.category === category.slug} /> {category.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Price (USD)</legend>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="minPrice">From</label>
                  <input id="minPrice" className="input" type="number" name="minPrice" min={0} step={1} defaultValue={query.minPrice} />
                </div>
                <div className="field">
                  <label htmlFor="maxPrice">To</label>
                  <input id="maxPrice" className="input" type="number" name="maxPrice" min={0} step={1} defaultValue={query.maxPrice} />
                </div>
              </div>
            </fieldset>
            <div className="field">
              <label htmlFor="sort">Sort by</label>
              <select id="sort" className="select" name="sort" defaultValue={query.sort}>
                {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="actions">
              <button type="submit" className="btn btn-primary">Apply</button>
              {hasFilters && <Link href="/products" className="btn">Clear</Link>}
            </div>
          </form>
        </details>

        <section aria-label="Products">
          <p className="muted result-count" role="status">
            {result.total} {result.total === 1 ? "product" : "products"}
          </p>
          {result.items.length === 0 ? (
            <div className="empty">
              <h2>Nothing matches yet</h2>
              <p className="muted">Try a different word, widen the price range or look through every category.</p>
              <Link href="/products" className="btn">Show all products</Link>
            </div>
          ) : (
            <div className="grid">
              {result.items.map((product) => <ProductTile key={product.id} product={product} />)}
            </div>
          )}
          {result.pageCount > 1 && (
            <nav className="pagination" aria-label="Pagination">
              {result.page > 1 ? <Link className="btn btn-small" href={pageHref(result.page - 1)}>Previous</Link> : <span />}
              <span className="muted">Page {result.page} of {result.pageCount}</span>
              {result.page < result.pageCount ? <Link className="btn btn-small" href={pageHref(result.page + 1)}>Next</Link> : <span />}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
