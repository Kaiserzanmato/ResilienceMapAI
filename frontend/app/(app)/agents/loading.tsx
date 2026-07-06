import { Skeleton } from "@/components/ui/Skeleton";

export default function AgentsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading AI workspace"
      className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6"
    >
      <Skeleton className="h-9 w-72" />
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Skeleton className="h-96" />
        <div className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-64" />
          <Skeleton className="h-12" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
