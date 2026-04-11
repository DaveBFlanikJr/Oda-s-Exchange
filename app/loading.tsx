import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="shell">
      <div className="grid">
        <section className="grid hero-grid">
          <article className="card hero-card">
            <Skeleton className="skeleton-pill" />
            <Skeleton className="skeleton-title" />
            <Skeleton className="skeleton-copy" />
            <Skeleton className="skeleton-copy short" />
            <div className="price-row">
              <Skeleton className="skeleton-price" />
              <Skeleton className="skeleton-badge" />
            </div>
          </article>
          <article className="card panel">
            <Skeleton className="skeleton-title small" />
            <Skeleton className="skeleton-copy" />
            <div className="stats">
              {Array.from({ length: 4 }).map((_, index) => (
                <div className="card stat" key={index}>
                  <Skeleton className="skeleton-copy short" />
                  <Skeleton className="skeleton-copy" />
                </div>
              ))}
            </div>
          </article>
        </section>

        <section className="catalog-layout">
          <aside className="card catalog-sidebar">
            <Skeleton className="skeleton-title small" />
            <Skeleton className="skeleton-copy short" />
            <Skeleton className="skeleton-copy short" />
            <Skeleton className="skeleton-copy short" />
          </aside>
          <div className="catalog-grid">
            {Array.from({ length: 10 }).map((_, index) => (
              <article className="card catalog-card" key={index}>
                <Skeleton className="catalog-image-shell" />
                <div className="catalog-card-body">
                  <Skeleton className="skeleton-copy short" />
                  <Skeleton className="skeleton-copy" />
                  <Skeleton className="skeleton-price small" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
