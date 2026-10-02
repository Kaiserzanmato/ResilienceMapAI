"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download, FileDown, FileSpreadsheet, FileText, FileCode2,
  Link2, Loader2, Maximize2, Sparkles, Zap, X,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, downloadExport, type UsageStatus } from "@/lib/api";
import { FLAGS } from "@/lib/feature-flags";
import {
  findFloodCapture, nearestCapture, pointBboxParam, summarizeCapture, coverageBbox, type FloodFeature,
} from "@/lib/flood-evidence";
import { orderHazards } from "@/lib/hazard-panel";
import { assessmentQueryKey, fetchAssessment } from "@/lib/queries/assessment";
import { useAppStore } from "@/lib/store";
import { formatResetClock } from "@/lib/usage-reset";
import { captureMapSnapshot, formatNumber, riskColor } from "@/lib/utils";
import { buildReportSnapshot, downloadTextFile } from "@/lib/report-snapshot";
import { snapshotToText, snapshotToMarkdown, snapshotToCsv } from "@/lib/report-formats";
import { GlassCard } from "@/components/ui/GlassCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { UsageMeter } from "@/components/ui/UsageMeter";
import { FloodFlagButton } from "./FloodFlagButton";
import { InsightsPanel } from "./InsightsPanel";
import type { InsightResponse } from "@/lib/types";

/** Policy wording for no-data states (SPRINT_1 coverage decision, section 4). Never styled as low risk. */
function statusLabel(status: string | undefined): string {
  switch (status) {
    case "out_of_coverage": return "Not covered by this source";
    case "unavailable": return "Temporarily unavailable";
    case "not_applicable": return "Not applicable";
    case "stale": return "Stale";
    case "expired": return "Expired; not used";
    case "suppressed": return "Unavailable for this view";
    default: return "Data status unknown";
  }
}

export function RiskSummaryWidget() {
  const {
    selected, setSelected, setRisk, persona, setAiOpen, activeTarget, personaMenuOpen, activeLayer, focusFloodCapture,
  } = useAppStore();
  // Read the assessment for the CURRENT selection straight from its query (the same cache
  // entry the map page fills). The store's `risk` is only updated after a fetch resolves, so
  // until then it still held the previous click: the panel then showed a stale name and
  // coordinates, and Flag / Export / Share acted on the wrong place.
  const { data: risk, isError: assessmentFailed, refetch: refetchAssessment } = useQuery({
    queryKey: assessmentQueryKey(selected),
    queryFn: () => fetchAssessment(selected!),
    enabled: !!selected,
  });
  // Satellite evidence for the Flood layer: a capture whose box covers the clicked spot.
  const floodLayerActive = FLAGS.FLOOD_CAPTURE && activeLayer === "flood";
  const { data: evidence } = useQuery({
    queryKey: ["flood-evidence", selected?.lat.toFixed(3), selected?.lng.toFixed(3)],
    queryFn: () => api.floodExtents(pointBboxParam(selected!.lat, selected!.lng, 0.15)),
    enabled: FLAGS.FLOOD_CAPTURE && !!selected, // also feeds the flag button's recapture hint
    staleTime: 60_000,
    retry: 1,
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<InsightResponse | null>(null);
  const [insightsUsage, setInsightsUsage] = useState<UsageStatus | null>(null);

  useEffect(() => {
    api.usageStatus().then((s) => setInsightsUsage(s.insights)).catch(() => {});
  }, []);

  // Close export menu on Escape or outside click
  useEffect(() => {
    if (!exportOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setExportOpen(false);
    const onClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [exportOpen]);

  if (!selected) return null;
  // The top-nav persona dropdown isn't aware of this widget's position and
  // can overlap it at narrower viewports — hide while it's open rather than
  // let the dropdown cut through the middle of this panel. Reappears the
  // instant the dropdown closes.
  if (personaMenuOpen) return null;
  if (!risk) {
    return (
      <GlassCard strong className="flex w-full flex-col gap-2 p-4 md:w-[340px]" role="status" aria-live="polite">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold">{selected.name ?? "Selected location"}</h2>
            <p className="text-[11px] text-[var(--fg-muted)]">{selected.lat.toFixed(3)}, {selected.lng.toFixed(3)}</p>
          </div>
          <button
            aria-label="Close risk summary"
            onClick={() => setSelected(null)}
            className="focus-ring -mr-1 cursor-pointer rounded-lg p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <X size={15} />
          </button>
        </div>
        {assessmentFailed ? (
          <p className="text-[12px] text-[var(--fg-muted)]">
            The assessment for this spot could not be loaded.{" "}
            <button onClick={() => refetchAssessment()} className="focus-ring cursor-pointer font-semibold text-[var(--accent)]">
              Retry
            </button>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-[12px] text-[var(--fg-muted)]">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" /> Loading the assessment for this spot…
          </p>
        )}
      </GlassCard>
    );
  }

  const slug = risk.location_name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  async function exportPdf() {
    if (!risk) return;
    setBusy("pdf");
    try {
      await downloadExport(
        "pdf",
        {
          lat: risk.latitude, lng: risk.longitude, name: risk.location_name,
          persona, map_image: captureMapSnapshot(),
        },
        `resiliencemap-${slug}.pdf`
      );
    } finally {
      setBusy(null);
    }
  }

  /**
   * TXT / Markdown / CSV exports share one immutable snapshot built from the
   * canonical store state at the instant of the click — no async gap between
   * reading state and generating the file, so stale exports are impossible.
   */
  function exportSnapshotFormat(format: "txt" | "md" | "csv") {
    if (!risk || busy) return;
    setBusy(format);
    setExportOpen(false);
    try {
      const snapshot = buildReportSnapshot({ risk, activeTarget, persona });
      const content =
        format === "txt" ? snapshotToText(snapshot)
        : format === "md" ? snapshotToMarkdown(snapshot)
        : snapshotToCsv(snapshot);
      const mime =
        format === "csv" ? "text/csv"
        : format === "md" ? "text/markdown"
        : "text/plain";
      downloadTextFile(`resiliencemap-${slug}.${format}`, content, mime);
      setExportNotice("Report downloaded");
    } catch {
      setExportNotice("Export failed — please retry");
    } finally {
      setBusy(null);
      setTimeout(() => setExportNotice(null), 3000);
    }
  }

  async function makeShareLink() {
    if (!risk) return;
    setBusy("share");
    try {
      const res = await api.shareLink({
        lat: risk.latitude, lng: risk.longitude,
        name: risk.location_name, persona,
      });
      const url = `${window.location.origin}/reports/shared/${res.report_id}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      setShareUrl(url);
      setTimeout(() => setShareUrl(null), 4000);
    } finally {
      setBusy(null);
    }
  }

  async function generateInsights() {
    if (!risk || !selected) return;
    if (insightsUsage && insightsUsage.remaining <= 0) {
      setInsightsError(
        `You've used all ${insightsUsage.limit} Insights for this period. ` +
          `Try again after ${(insightsUsage.resets_at ? formatResetClock(insightsUsage.resets_at) : "a little later")}.`
      );
      setInsightsOpen(true);
      return;
    }
    setInsightsLoading(true);
    setInsightsError(null);
    setBusy("insights");
    try {
      const result = await api.generateInsights(
        selected.lat,
        selected.lng,
        risk.location_name,
        "overall",
        persona
      );
      setInsightsData(result.insight);
      setInsightsOpen(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate insights";
      setInsightsError(message);
      setInsightsOpen(true);
    } finally {
      setInsightsLoading(false);
      setBusy(null);
      api.usageStatus().then((s) => setInsightsUsage(s.insights)).catch(() => {});
    }
  }

  const ordered = orderHazards(risk.hazards, activeLayer);
  const evidenceFeatures = evidence?.features as unknown as FloodFeature[] | undefined;
  const spotCapture = FLAGS.FLOOD_CAPTURE ? findFloodCapture(evidenceFeatures, selected.lat, selected.lng) : null;
  const capture = floodLayerActive ? spotCapture : null;
  const nearby = floodLayerActive && !capture ? nearestCapture(evidenceFeatures, selected.lat, selected.lng) : null;

  const actions = [
    { key: "insights", label: "Insights", icon: Zap, onClick: generateInsights },
    { key: "ai", label: "Ask AI", icon: Sparkles, onClick: () => setAiOpen(true) },
    { key: "export", label: "Export", icon: Download, onClick: () => setExportOpen((v) => !v) },
    { key: "share", label: shareUrl ? "Copied!" : "Share", icon: Link2, onClick: makeShareLink },
  ];

  const exportOptions = [
    { key: "pdf", label: "PDF Report", desc: "Shareable formatted risk brief", icon: FileDown, onClick: () => { setExportOpen(false); exportPdf(); } },
    { key: "txt", label: "Text File", desc: "Readable plain-text assessment", icon: FileText, onClick: () => exportSnapshotFormat("txt") },
    { key: "md", label: "Markdown Report", desc: "Portable evidence-rich report", icon: FileCode2, onClick: () => exportSnapshotFormat("md") },
    { key: "csv", label: "CSV Data", desc: "Structured records for analysis", icon: FileSpreadsheet, onClick: () => exportSnapshotFormat("csv") },
  ];

  return (
    <AnimatePresence>
      <motion.div
        key={risk.location_name}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: "spring", damping: 26, stiffness: 300 }}
      >
        <GlassCard
          strong
          className="flex w-full flex-col p-4 md:w-[340px]"
          style={{ maxHeight: "min(640px, calc(100vh - var(--nav-h) - var(--banner-h) - var(--footer-h) - 32px))" }}
        >
          <div className="flex shrink-0 items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold">{risk.location_name}</h2>
              <p className="text-[11px] text-[var(--fg-muted)]">
                {risk.latitude.toFixed(3)}, {risk.longitude.toFixed(3)} ·{" "}
                {risk.confidence} confidence
              </p>
              {risk.components_total ? (
                <p className="text-[11px] text-[var(--fg-muted)]">
                  {risk.components_available
                    ? `Overall from ${risk.components_available} of ${risk.components_total} hazards with available data`
                    : `No hazard has verified data here yet (0 of ${risk.components_total})`}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <RiskBadge risk={risk.overall} />
              <span className="text-[9.5px] uppercase tracking-wide text-[var(--fg-muted)]">Overall</span>
            </div>
            <button
              aria-label="Close risk summary"
              onClick={() => {
                setSelected(null);
                setRisk(null);
              }}
              className="focus-ring -mr-1 cursor-pointer rounded-lg p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)]"
            >
              <X size={15} />
            </button>
          </div>

          {/* Scrollable hazard data — header and actions stay pinned outside this region */}
          <div className="scroll-visible mt-3 min-h-0 flex-1 overflow-y-auto pr-2 -mr-2">
            {activeLayer !== "overall" && ordered[0]?.active && (
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--accent)]">
                Selected layer: {ordered[0].hazard.label}
              </p>
            )}
            <ul className="space-y-2">
              {ordered.map(({ key, hazard: h, active }) => (
                <li
                  key={key}
                  className={active ? "rounded-lg border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-2" : undefined}
                  aria-current={active ? "true" : undefined}
                >
                  <div className="mb-0.5 flex items-center justify-between text-[12px]">
                    <span className={active ? "font-semibold" : "font-medium"}>{h.label}</span>
                    {h.score === null ? (
                      <span className="text-[11px] text-[var(--fg-muted)]">
                        {active && key === "flood" && capture ? "Satellite evidence" : statusLabel(h.coverage_status)}
                      </span>
                    ) : (
                      <span className="font-semibold" style={{ color: riskColor(h.color) }}>
                        {`${h.score} · ${h.level}`}
                      </span>
                    )}
                  </div>
                  {h.score === null ? (
                    h.indicative_score != null && (
                      <p className="text-[10.5px] text-[var(--fg-muted)]">
                        Indicative {h.indicative_source_type === "curated-zone-model" ? "zone model" : "country baseline"}: {h.indicative_score}/100, not a verified score
                      </p>
                    )
                  ) : (
                    <div
                      role="progressbar"
                      aria-label={`${h.label} risk score`}
                      aria-valuenow={h.score}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_10%,transparent)]"
                    >
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${h.score}%` }}
                        transition={{ duration: 0.7, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: riskColor(h.color) }}
                      />
                    </div>
                  )}
                  {active && key === "flood" && floodLayerActive && (
                    <FloodEvidence
                      capture={capture}
                      nearby={nearby}
                      onZoom={(feature) => {
                        const box = coverageBbox(feature);
                        if (box) focusFloodCapture(box);
                      }}
                    />
                  )}
                </li>
              ))}
            </ul>

            {risk.main_drivers.length > 0 && (
              <p className="mt-3 text-[11.5px] text-[var(--fg-muted)]">
                <span className="font-semibold text-[var(--fg)]">Main drivers:</span>{" "}
                {risk.main_drivers.join(", ")}
              </p>
            )}

            {risk.nearest_zone && (
              <p className="mt-1.5 text-[11.5px] text-[var(--fg-muted)]">
                Pop. {formatNumber(risk.nearest_zone.population)} ·{" "}
                {risk.nearest_zone.critical_facilities} critical facilities ·{" "}
                {risk.nearest_zone.hospitals} hospitals
              </p>
            )}
          </div>

          {FLAGS.FLOOD_CAPTURE && (
            <FloodFlagButton key={`${selected.lat},${selected.lng}`} lat={selected.lat} lng={selected.lng} capture={spotCapture?.properties} />
          )}

          <div ref={exportMenuRef} className="relative mt-3.5 shrink-0">
            {/* Export dropdown menu — opens above the action row */}
            {exportOpen && (
              <div
                role="menu"
                aria-label="Export report formats"
                className="glass-strong absolute bottom-full left-0 right-0 z-20 mb-2 overflow-hidden rounded-xl p-1.5"
              >
                {exportOptions.map((o) => (
                  <button
                    key={o.key}
                    role="menuitem"
                    onClick={o.onClick}
                    disabled={busy !== null}
                    className="focus-ring flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] disabled:opacity-50"
                  >
                    <o.icon size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-[12px] font-semibold">{o.label}</span>
                      <span className="block truncate text-[10.5px] text-[var(--fg-muted)]">{o.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-1.5">
              {actions.map((a) => (
                <button
                  key={a.key}
                  onClick={a.onClick}
                  disabled={busy !== null}
                  aria-haspopup={a.key === "export" ? "menu" : undefined}
                  aria-expanded={a.key === "export" ? exportOpen : undefined}
                  className="focus-ring glass flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 flex-1 min-w-[60px]"
                >
                  {busy === a.key || (a.key === "export" && busy && ["pdf", "txt", "md", "csv"].includes(busy)) ? (
                    <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                  ) : (
                    <a.icon size={15} aria-hidden="true" />
                  )}
                  {a.label}
                </button>
              ))}
            </div>

            {exportNotice && (
              <p role="status" className="mt-2 text-center text-[10.5px] font-medium text-[var(--accent)]">
                {exportNotice}
              </p>
            )}
          </div>

          <UsageMeter
            label="Insights usage"
            unitLabel="insights"
            status={insightsUsage}
            onExpire={() => api.usageStatus().then((s) => setInsightsUsage(s.insights)).catch(() => {})}
            className="mt-3 shrink-0"
          />

          <p className="mt-3 shrink-0 text-[10px] leading-snug text-[var(--fg-muted)]">
            Indicative scores from official datasets — not an official advisory.
            Updated {new Date(risk.generated_at).toLocaleDateString()}.
          </p>
        </GlassCard>
      </motion.div>

      <InsightsPanel
        isOpen={insightsOpen}
        isLoading={insightsLoading}
        error={insightsError}
        insight={insightsData}
        locationName={risk.location_name}
        onClose={() => {
          setInsightsOpen(false);
          setInsightsData(null);
          setInsightsError(null);
        }}
      />
    </AnimatePresence>
  );
}

/** The Flood row's satellite evidence: a capture covering the spot, else the nearest one,
 * else how to request one. It states what was measured (scene date, source, water area)
 * and never produces a risk score. */
function FloodEvidence({
  capture, nearby, onZoom,
}: {
  capture: FloodFeature | null;
  nearby: { feature: FloodFeature; distanceKm: number } | null;
  onZoom: (feature: FloodFeature) => void;
}) {
  const shown = capture ?? nearby?.feature ?? null;
  return (
    <div className="mt-1.5 text-[10.5px] leading-snug text-[var(--fg-muted)]">
      {capture ? (
        <p>
          <span className="font-semibold text-[var(--fg)]">Satellite evidence.</span> {summarizeCapture(capture.properties).text}{" "}
          Not a verified flood score; open water may include permanent water.
        </p>
      ) : nearby ? (
        <p>
          No satellite capture covers this exact spot. The nearest is {nearby.distanceKm < 10 ? nearby.distanceKm.toFixed(1) : Math.round(nearby.distanceKm)} km
          away: {summarizeCapture(nearby.feature.properties).text}
        </p>
      ) : (
        <p>No satellite capture covers this spot yet. Use Flag flooding here to request one.</p>
      )}
      {shown && (
        <button
          onClick={() => onZoom(shown)}
          className="focus-ring mt-1 inline-flex cursor-pointer items-center gap-1 font-semibold text-[var(--accent)]"
        >
          <Maximize2 size={11} aria-hidden="true" /> Zoom to capture
        </button>
      )}
    </div>
  );
}
