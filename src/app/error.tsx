"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="container section empty" role="alert">
      <h1>Something went wrong</h1>
      <p className="muted">An unexpected error stopped this page from loading. Nothing was charged. Try again.</p>
      <button type="button" className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  );
}
