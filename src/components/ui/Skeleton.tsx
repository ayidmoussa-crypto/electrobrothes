// Pulse is disabled automatically by the reduced-motion rule in globals.css.
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-warm-100 ${className}`} />;
}

/** Same footprint as <ProductCard> so the grid does not jump when data arrives (CLS). */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-warm-200">
      <Skeleton className="aspect-square rounded-none" />
      <div className="flex flex-col gap-2 p-3 sm:p-4">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="mt-2 h-6 w-24" />
        <Skeleton className="mt-1 h-11 w-full rounded-full" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8, label }: { count?: number; label: string }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: count }, (_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
