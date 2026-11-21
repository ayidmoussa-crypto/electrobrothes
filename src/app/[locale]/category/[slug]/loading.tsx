import { ProductGridSkeleton, Skeleton } from "@/components/ui/Skeleton";

/** Shown at once while the category's params and data arrive, so the navigation is instant. */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-16">
      <Skeleton className="my-4 h-5 w-48" />
      <Skeleton className="h-48 w-full rounded-3xl md:h-64" />
      <div className="mt-6">
        <ProductGridSkeleton label="…" />
      </div>
    </div>
  );
}
