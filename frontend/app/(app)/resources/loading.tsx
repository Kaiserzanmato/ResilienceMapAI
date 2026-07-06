import { Skeleton } from "@/components/ui/Skeleton";

export default function ResourcesLoading() {
  return (
    <div
      role="status"
      aria-label="Loading resources"
      className="mx-auto max-w-6xl space-y-10 px-4 py-6 md:px-6 lg:px-8"
    >
      <div className="space-y-3">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="aspect-video w-full rounded-2xl" />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
