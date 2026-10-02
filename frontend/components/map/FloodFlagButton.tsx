"use client";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Waves } from "lucide-react";
import { useEffect, useState } from "react";
import { api, type FloodJob } from "@/lib/api";
import { describeFlagFailure, describeFloodArea, recaptureHint, type FloodExtentProps } from "@/lib/flood-evidence";
import { useAppStore } from "@/lib/store";

const FAST_POLL_MS = 3_000;
const SLOW_POLL_MS = 8_000;
const FAST_POLL_WINDOW_MS = 30_000;
const GIVE_UP_MS = 5 * 60_000;

const SOURCE_LABEL: Record<string, string> = {
  "s1-rtc-pc": "Sentinel-1 radar",
  "s2-l2a-e84": "Sentinel-2 optical",
};

type Phase =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "working"; jobId: number; status: "queued" | "running" }
  | { kind: "done"; extent: NonNullable<FloodJob["extent"]> }
  | { kind: "no_scene"; message: string }
  | { kind: "failed"; message: string }
  | { kind: "slow" }
  | { kind: "error"; message: string };

/** One flag per click: saves the report, then follows the capture job until it
 * ends. The parent keys this by location so a new selection starts fresh. */
export function FloodFlagButton({ lat, lng, capture }: { lat: number; lng: number; capture?: FloodExtentProps | null }) {
  const queryClient = useQueryClient();
  const focusFloodCapture = useAppStore((s) => s.focusFloodCapture);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const jobId = phase.kind === "working" ? phase.jobId : null;
  useEffect(() => {
    if (jobId === null) return;
    const startedAt = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;

    async function poll() {
      try {
        const job = await api.floodJob(jobId as number);
        if (cancelled) return;
        if (job.status === "done") {
          queryClient.invalidateQueries({ queryKey: ["flood-extents"] });
          queryClient.invalidateQueries({ queryKey: ["flood-evidence"] });
          queryClient.invalidateQueries({ queryKey: ["flood-flags"] });
          // Fit the map to the capture so the result is actually seen, not left as a speck at city zoom.
          if (job.extent?.aoi_bbox) focusFloodCapture(job.extent.aoi_bbox);
          setPhase(job.extent ? { kind: "done", extent: job.extent } : { kind: "failed", message: "No result was stored." });
          return;
        }
        if (job.status === "no_scene") {
          setPhase({ kind: "no_scene", message: job.message ?? "No recent satellite scene covers this spot." });
          return;
        }
        if (job.status === "failed") {
          setPhase({ kind: "failed", message: job.message ?? "Capture failed." });
          return;
        }
        setPhase({ kind: "working", jobId: jobId as number, status: job.status === "running" ? "running" : "queued" });
      } catch {
        // A sleeping server can drop a poll; keep trying until the time limit.
      }
      if (cancelled) return;
      const elapsed = Date.now() - startedAt;
      if (elapsed >= GIVE_UP_MS) {
        setPhase({ kind: "slow" });
        return;
      }
      timer = setTimeout(poll, elapsed < FAST_POLL_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS);
    }

    timer = setTimeout(poll, FAST_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [jobId, queryClient, focusFloodCapture]);

  async function flag() {
    setPhase({ kind: "submitting" });
    try {
      const res = await api.flagFlood(lat, lng);
      queryClient.invalidateQueries({ queryKey: ["flood-flags"] });
      setPhase({ kind: "working", jobId: res.job_id, status: "queued" });
    } catch (err) {
      console.error("[flood] flag request failed", err);
      setPhase({ kind: "error", message: describeFlagFailure(err) });
    }
  }

  const busy = phase.kind === "submitting" || phase.kind === "working";

  return (
    <div className="mt-2 shrink-0 rounded-xl border border-[var(--surface-border)] px-2 py-1">
      <button
        onClick={flag}
        disabled={busy}
        title="Saves your report and maps the water from the newest Sentinel satellite scene"
        className="focus-ring flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--accent)] transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] disabled:cursor-default disabled:opacity-60"
      >
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Waves size={14} aria-hidden="true" />}
        Flag flooding here
      </button>

      <div role="status" aria-live="polite" className="text-[10.5px] leading-snug text-[var(--fg-muted)]">
        {phase.kind === "idle" && (
          <span className="block pb-0.5 text-center">
            {recaptureHint(capture) ?? "Maps the water from the newest Sentinel scene."}
          </span>
        )}
        {phase.kind === "submitting" && "Saving your report…"}
        {phase.kind === "working" &&
          (phase.status === "running"
            ? "Reading satellite imagery… this can take a minute or two."
            : "Queued, waiting for a satellite scene. A sleeping server can add up to a minute.")}
        {phase.kind === "done" && (
          <>
            <span className="font-semibold text-[var(--fg)]">Captured.</span>{" "}
            {SOURCE_LABEL[phase.extent.source] ?? "Satellite"}, scene of {phase.extent.acquired_at.slice(0, 10)}:{" "}
            {describeFloodArea(phase.extent).text} in the 5 km box
            {phase.extent.water_area_m2 > 0 ? " (the map zooms to it)." : "."}{" "}
            {phase.extent.permanent_water_filtered
              ? "Satellite-derived estimate; permanent water removed using JRC Global Surface Water. Not an official flood map."
              : `${describeFloodArea(phase.extent).unfilteredNote} Satellite-derived estimate; not an official flood map.`}
          </>
        )}
        {phase.kind === "no_scene" && `Your flag is saved. ${phase.message}`}
        {phase.kind === "failed" && `Your flag is saved, but capture failed. ${phase.message}`}
        {phase.kind === "slow" && "Still processing. Your flag is saved; the water will appear on the map when it finishes."}
        {phase.kind === "error" && phase.message}
      </div>
    </div>
  );
}
