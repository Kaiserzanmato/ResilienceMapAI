"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  FileDown, FileSpreadsheet, Link2, Loader2, Sparkles, Zap, X,
} from "lucide-react";
import { useState } from "react";
import { api, downloadExport } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { captureMapSnapshot, formatNumber, riskColor } from "@/lib/utils";
import { GlassCard } from "@/components/ui/GlassCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { InsightsPanel } from "./InsightsPanel";

export function RiskSummaryWidget() {
  const { risk, selected, setSelected, setRisk, persona, setAiOpen } = useAppStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsData, setInsightsData] = useState<any>(null);

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

  async function exportCsv() {
    if (!risk) return;
    setBusy("csv");
    try {
      await downloadExport(
        "csv",
        { locations: [{ lat: risk.latitude, lng: risk.longitude, name: risk.location_name }] },
        `resiliencemap-${slug}.csv`
      );
    } finally {
      setBusy(null);
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
    }
  }

  const actions = [
    { key: "insights", label: "Insights", icon: Zap, onClick: generateInsights },
    { key: "ai", label: "Ask AI", icon: Sparkles, onClick: () => setAiOpen(true) },
    { key: "pdf", label: "PDF", icon: FileDown, onClick: exportPdf },
    { key: "csv", label: "CSV", icon: FileSpreadsheet, onClick: exportCsv },
    { key: "share", label: shareUrl ? "Copied!" : "Share", icon: Link2, onClick: makeShareLink },
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

          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {actions.map((a) => (
              <button
                key={a.key}
                onClick={a.onClick}
                disabled={busy !== null}
                className="focus-ring glass flex cursor-pointer flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-[11px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 flex-1 min-w-[60px]"
              >
                {busy === a.key ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <a.icon size={15} aria-hidden="true" />
                )}
                {a.label}
              </button>
            ))}
          </div>

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
