"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Download, FileDown, FileSpreadsheet, FileText, FileCode2,
  Link2, Loader2, Sparkles, Zap, X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api, downloadExport, type UsageStatus } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { captureMapSnapshot, formatNumber, riskColor } from "@/lib/utils";
import { buildReportSnapshot, downloadTextFile } from "@/lib/report-snapshot";
import { snapshotToText, snapshotToMarkdown, snapshotToCsv } from "@/lib/report-formats";
import { GlassCard } from "@/components/ui/GlassCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { UsageMeter } from "@/components/ui/UsageMeter";
import { InsightsPanel } from "./InsightsPanel";

export function RiskSummaryWidget() {
  const { risk, selected, setSelected, setRisk, persona, setAiOpen, activeTarget } = useAppStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<unknown>(null);
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

  if (!selected || !risk) return null;

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
          `Try again after ${new Date(insightsUsage.resets_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
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
        <GlassCard strong className="w-full p-4 md:w-[340px]">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold">{risk.location_name}</h2>
              <p className="text-[11px] text-[var(--fg-muted)]">
                {risk.latitude.toFixed(3)}, {risk.longitude.toFixed(3)} ·{" "}
                {risk.confidence} confidence
              </p>
            </div>
            <RiskBadge risk={risk.overall} />
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

          {/* Hazard bars */}
          <ul className="mt-3 space-y-2">
            {Object.entries(risk.hazards).map(([key, h]) => (
              <li key={key}>
                <div className="mb-0.5 flex items-center justify-between text-[12px]">
                  <span className="font-medium">{h.label}</span>
                  <span className="font-semibold" style={{ color: riskColor(h.color) }}>
                    {h.score === null ? "No data" : `${h.score} · ${h.level}`}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-label={`${h.label} risk score`}
                  aria-valuenow={h.score ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_10%,transparent)]"
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${h.score ?? 0}%` }}
                    transition={{ duration: 0.7, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ background: riskColor(h.color) }}
                  />
                </div>
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

          <div ref={exportMenuRef} className="relative mt-3.5">
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
            className="mt-3"
          />

          <p className="mt-3 text-[10px] leading-snug text-[var(--fg-muted)]">
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
