export default function Loading() {
  return (
    <div className="container section" aria-busy="true" aria-label="Loading products">
      <div className="skeleton skeleton-title" />
      <div className="grid">
        {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton skeleton-tile" />)}
      </div>
    </div>
  );
}
