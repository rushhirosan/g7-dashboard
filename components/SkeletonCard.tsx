export function SkeletonCard() {
  return (
    <article className="card" aria-hidden="true">
      <header className="card-header">
        <div className="country-wrap">
          <div className="skeleton skeleton-flag" />
          <div className="country-text">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-source" style={{ marginTop: 6 }} />
          </div>
        </div>
        <div className="skeleton skeleton-badge" />
      </header>
      <div className="headline-list">
        {Array.from({ length: 5 }).map((_, i) => (
          <div className="headline" key={i}>
            <div className="skeleton skeleton-number" />
            <div style={{ flex: 1 }}>
              <div className="skeleton skeleton-headline-title" />
              <div className="skeleton skeleton-headline-meta" />
            </div>
          </div>
        ))}
      </div>
      <footer className="card-footer">
        <div className="skeleton skeleton-source-link" />
      </footer>
    </article>
  );
}
