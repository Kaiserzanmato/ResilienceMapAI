import { Skeleton } from "@/components/ui/Skeleton";

export default function WeatherLoading() {
  return (
    <div
      role="status"
      aria-label="Loading weather map"
      className="relative h-[calc(100vh-var(--banner-h)-var(--nav-h)-20px)] w-full px-3 sm:px-4"
    >
      <Skeleton className="h-full w-full rounded-2xl" />
      <span className="sr-only">Loading weather map…</span>
    </div>
  );
}
