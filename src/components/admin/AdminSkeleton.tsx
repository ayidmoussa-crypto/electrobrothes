import { Skeleton } from "@/components/ui/Skeleton";

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      {children}
    </div>
  );
}

function Header({ action = true }: { action?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-3">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      {action ? <Skeleton className="h-11 w-32 rounded-lg" /> : null}
    </div>
  );
}

export function StatCardsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="admin-card space-y-3 p-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-8 w-28" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="admin-card overflow-hidden">
      <div className="flex gap-4 border-b border-warm-200 p-4">
        {Array.from({ length: cols }, (_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 border-b border-warm-200 p-4 last:border-b-0">
          {Array.from({ length: cols }, (_, c) => (
            <Skeleton key={c} className={`h-4 flex-1 ${c === 0 ? "max-w-48" : ""}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <Wrap>
      <Header />
      <StatCardsSkeleton count={4} />
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="admin-card p-4 lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="admin-card space-y-3 p-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mx-auto size-36 rounded-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
      <TableSkeleton rows={5} cols={6} />
    </Wrap>
  );
}

export function ListSkeleton() {
  return (
    <Wrap>
      <Header />
      <StatCardsSkeleton count={3} />
      <div className="mb-3 flex gap-2">
        <Skeleton className="h-11 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-11 w-24 rounded-lg" />
      </div>
      <TableSkeleton />
    </Wrap>
  );
}

export function FormSkeleton() {
  return (
    <Wrap>
      <Header action={false} />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="admin-card space-y-5 p-5 lg:col-span-2">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          ))}
          <Skeleton className="h-11 w-36 rounded-lg" />
        </div>
        <div className="admin-card space-y-3 p-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      </div>
    </Wrap>
  );
}
