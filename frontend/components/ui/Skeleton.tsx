import { cn } from "@/lib/utils";

/**
 * Skeleton loading placeholder. Shimmer is defined in globals.css (.skeleton),
 * uses transform-only animation (GPU-friendly) and is disabled automatically
 * under prefers-reduced-motion.
 */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

/** Full-page skeleton scaffold shared by route-level loading states. */
export function PageSkeleton({
  title = true,
  cards = 4,
  chart = false,
}: {
  title?: boolean;
  cards?: number;
  chart?: boolean;
}) {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      className="mx-auto max-w-[1800px] space-y-6 px-4 py-6 sm:px-6"
    >
      {title && (
        <div className="space-y-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      {chart && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      )}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
