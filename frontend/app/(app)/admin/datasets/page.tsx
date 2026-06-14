"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Database,
  ExternalLink,
  Loader2,
  Plus,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, API_BASE } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";
import { FLAGS } from "@/lib/feature-flags";

const CONFIDENCE_TONE: Record<string, string> = {
  High: "var(--risk-low)",
  Medium: "var(--risk-medium)",
  Low: "var(--risk-high)",
};

const TRUST_LABEL: Record<number, string> = {
  1: "Official warning",
  2: "UN-backed report",
  3: "Research-grade",
  4: "Specialized ops",
  5: "Manual curated",
};

const SYNC_STATUS_COLOR: Record<string, string> = {
  success: "var(--risk-low)",
  failed: "var(--risk-high)",
  partial: "var(--risk-medium)",
  disabled: "var(--fg-muted)",
  never: "var(--fg-muted)",
};

const EMPTY_FORM = {
  name: "",
  agency: "",
  category: "flood",
  url: "",
  confidence: "Medium",
  records: 0,
};

interface SyncHealthEntry {
  source_id: string;
  source_name: string;
  organization: string;
  coverage: string;
  domains: string[];
  access_type: string;
  trust_level: number;
  confidence_category: string;
  enabled: boolean;
  auto_sync_enabled: boolean;
  sync_frequency_minutes: number | null;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  last_sync_status: string | null;
  records_synced: number;
  error: string | null;
  is_stale: boolean;
  source_url: string;
  docs_url: string | null;
  requires_api_key: boolean;
  requires_registration: boolean;
  license_notes: string | null;
}

async function fetchSyncHealth(): Promise<{ sync_health: SyncHealthEntry[] }> {
  const res = await fetch(`${API_BASE}/api/sync-health`);
  if (!res.ok) throw new Error("Failed to load sync health");
  return res.json();
}

export default function DatasetsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["datasets"], queryFn: api.datasets });
  const { data: syncData, isLoading: syncLoading } = useQuery({
    queryKey: ["sync-health"],
    queryFn: fetchSyncHealth,
    enabled: FLAGS.SOURCE_HEALTH_MONITORING,
    refetchInterval: 60_000,
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sources" | "datasets">(
    FLAGS.SOURCE_HEALTH_MONITORING ? "sources" : "datasets"
  );

  const upload = useMutation({
    mutationFn: api.uploadDataset,
    onSuccess: (res) => {
      setMessage(res.message);
      setForm(EMPTY_FORM);
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["datasets"] });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (e) => setMessage(`Upload failed: ${(e as Error).message}`),
  });

  const inputCls =
    "focus-ring w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-solid)] px-3 py-2.5 text-[13.5px] placeholder:text-[var(--fg-muted)]";

  const syncEntries = syncData?.sync_health ?? [];
  const staleSources = syncEntries.filter((s) => s.is_stale && s.enabled);
  const failedSources = syncEntries.filter((s) => s.last_sync_status === "failed");

  return (
    <div className="mx-auto max-w-[1400px] px-4 pb-20">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Dataset <span className="text-gradient">Management</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">
            Global source registry — official agencies, sync health, and approved data provenance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {FLAGS.SOURCE_HEALTH_MONITORING && (
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["sync-health"] })}
              className="focus-ring glass flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              <RefreshCw size={14} aria-hidden="true" /> Refresh
            </button>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="focus-ring flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-medium text-white hc:text-black shadow-[0_4px_20px_var(--accent-glow)] transition-all hover:brightness-110"
          >
            <Plus size={15} aria-hidden="true" /> Register dataset
          </button>
        </div>
      </div>

      {/* Sync health alerts */}
      {FLAGS.SOURCE_HEALTH_MONITORING && (staleSources.length > 0 || failedSources.length > 0) && (
        <div className="mb-4 space-y-2">
          {failedSources.length > 0 && (
            <GlassCard className="flex items-center gap-2 px-4 py-3 text-[13px]">
              <XCircle size={15} className="shrink-0 text-[var(--risk-high)]" aria-hidden="true" />
              <span>
                <strong>{failedSources.length} source(s) failed last sync:</strong>{" "}
                {failedSources.map((s) => s.source_name).join(", ")} — last successful data is preserved.
              </span>
            </GlassCard>
          )}
          {staleSources.length > 0 && (
            <GlassCard className="flex items-center gap-2 px-4 py-3 text-[13px]">
              <AlertTriangle size={15} className="shrink-0 text-[var(--risk-medium)]" aria-hidden="true" />
              <span>
                <strong>{staleSources.length} source(s) may have stale data:</strong>{" "}
                {staleSources.map((s) => s.source_name).join(", ")}
              </span>
            </GlassCard>
          )}
        </div>
      )}

      {message && (
        <GlassCard className="mb-4 flex items-center gap-2 px-4 py-3 text-[13px]">
          <CheckCircle2 size={15} className="text-[var(--risk-low)]" aria-hidden="true" />
          {message}
        </GlassCard>
      )}

      {/* Register dataset form */}
      {showForm && (
        <GlassCard strong className="mb-4 p-5">
          <h2 className="mb-3 text-[14px] font-semibold">Register dataset metadata</h2>
          <p className="mb-4 text-[12px] text-[var(--fg-muted)]">
            Requires the{" "}
            <code className="rounded bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-1.5 py-0.5">
              dataset_admin
            </code>{" "}
            role. Sources must be HTTPS and from trusted agencies (USGS, NOAA, PAGASA, PHIVOLCS, Copernicus…).
          </p>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              upload.mutate(form);
            }}
          >
            <label className="text-[12px] font-medium">
              Dataset name
              <input
                required
                minLength={3}
                className={cn(inputCls, "mt-1")}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="USGS Seismic Hazard Update"
              />
            </label>
            <label className="text-[12px] font-medium">
              Source agency
              <input
                required
                minLength={2}
                className={cn(inputCls, "mt-1")}
                value={form.agency}
                onChange={(e) => setForm({ ...form, agency: e.target.value })}
                placeholder="USGS"
              />
            </label>
            <label className="text-[12px] font-medium">
              Category
              <select
                className={cn(inputCls, "mt-1 cursor-pointer")}
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {[
                  "flood", "earthquake", "tropical_cyclone", "volcano",
                  "landslide", "storm_surge", "humanitarian", "conflict", "multi",
                ].map((c) => (
                  <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-medium">
              Confidence
              <select
                className={cn(inputCls, "mt-1 cursor-pointer")}
                value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: e.target.value })}
              >
                {["High", "Medium", "Low"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-medium sm:col-span-2">
              Source URL (HTTPS required)
              <input
                required
                type="url"
                pattern="https://.*"
                className={cn(inputCls, "mt-1")}
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://earthquake.usgs.gov/…"
              />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={upload.isPending}
                className="focus-ring flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[13px] font-medium text-white hc:text-black disabled:opacity-50"
              >
                {upload.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Register
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="focus-ring glass h-10 cursor-pointer rounded-xl px-5 text-[13px] font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Tabs */}
      {FLAGS.SOURCE_HEALTH_MONITORING && (
        <div className="mb-4 flex gap-2">
          {(["sources", "datasets"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "focus-ring rounded-xl px-4 py-2 text-[13px] font-medium transition-all",
                activeTab === tab
                  ? "bg-[var(--accent)] text-white hc:text-black"
                  : "glass hover:border-[var(--accent)] hover:text-[var(--accent)]"
              )}
            >
              {tab === "sources" ? `Source Registry (${syncEntries.length})` : `Datasets (${data?.datasets?.length ?? 0})`}
            </button>
          ))}
        </div>
      )}

      {/* Source Registry Tab */}
      {activeTab === "sources" && FLAGS.SOURCE_HEALTH_MONITORING && (
        <>
          {syncLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="glass h-52 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {syncEntries.map((s) => (
                <GlassCard
                  key={s.source_id}
                  className={cn(
                    "flex flex-col p-5 transition-all hover:-translate-y-0.5",
                    !s.enabled && "opacity-60"
                  )}
                >
                  {/* Header */}
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
                        <Database size={14} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-[13px] font-semibold leading-tight">{s.source_name}</p>
                        <p className="text-[11px] text-[var(--fg-muted)]">{s.organization}</p>
                      </div>
                    </div>
                    {s.is_stale && s.auto_sync_enabled && (
                      <AlertTriangle
                        size={14}
                        className="shrink-0 text-[var(--risk-medium)]"
                        aria-label="Stale data"
                      />
                    )}
                  </div>

                  {/* Domains + Coverage */}
                  <div className="mb-3 flex flex-wrap gap-1">
                    <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] font-medium capitalize text-[var(--fg-muted)]">
                      {s.coverage}
                    </span>
                    {s.domains.slice(0, 2).map((d) => (
                      <span
                        key={d}
                        className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]"
                      >
                        {d.replace(/_/g, " ")}
                      </span>
                    ))}
                    <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)] capitalize">
                      {s.access_type}
                    </span>
                  </div>

                  {/* Sync status */}
                  <div className="space-y-1 text-[11.5px] text-[var(--fg-muted)]">
                    <div className="flex items-center justify-between gap-2">
                      <span>Auto-sync</span>
                      <span
                        className="font-medium"
                        style={{ color: s.auto_sync_enabled ? "var(--risk-low)" : "var(--fg-muted)" }}
                      >
                        {s.auto_sync_enabled
                          ? s.sync_frequency_minutes != null
                            ? `every ${s.sync_frequency_minutes}m`
                            : "enabled"
                          : "manual only"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Last sync</span>
                      <span className="font-medium" style={{ color: SYNC_STATUS_COLOR[s.last_sync_status ?? "never"] }}>
                        {s.last_sync_status ?? "never"}
                      </span>
                    </div>
                    {s.last_successful_sync_at && (
                      <div className="flex items-center justify-between gap-2">
                        <span>Last success</span>
                        <span className="font-medium">
                          {new Date(s.last_successful_sync_at).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {s.records_synced > 0 && (
                      <div className="flex items-center justify-between gap-2">
                        <span>Records synced</span>
                        <span className="font-medium">{formatNumber(s.records_synced)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span>Trust level</span>
                      <span className="font-medium">
                        {s.trust_level} — {TRUST_LABEL[s.trust_level] ?? "Unknown"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span>Confidence</span>
                      <span className="font-medium capitalize">
                        {s.confidence_category.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  {/* Status badges */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.requires_api_key && (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--risk-medium)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--risk-medium)]">
                        API key req.
                      </span>
                    )}
                    {s.requires_registration && (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--accent)]">
                        Registration req.
                      </span>
                    )}
                    {!s.enabled && (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--fg-muted)]">
                        Disabled
                      </span>
                    )}
                    {s.is_stale && s.auto_sync_enabled && (
                      <span className="rounded-full bg-[color-mix(in_srgb,var(--risk-medium)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--risk-medium)]">
                        Stale
                      </span>
                    )}
                  </div>

                  {/* Links */}
                  <div className="mt-3 flex items-center gap-3">
                    <a
                      href={s.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                    >
                      Source <ExternalLink size={10} aria-hidden="true" />
                    </a>
                    {s.docs_url && (
                      <a
                        href={s.docs_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="focus-ring inline-flex items-center gap-1 text-[12px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)] hover:underline"
                      >
                        Docs <ExternalLink size={10} aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* Datasets Tab */}
      {activeTab === "datasets" && (
        <>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass h-40 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data?.datasets.map((d) => (
                <GlassCard
                  key={d.id}
                  className="flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_var(--accent-glow)]"
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent-2)_14%,transparent)] text-[var(--accent-2)]">
                      <Database size={16} aria-hidden="true" />
                    </span>
                    <span
                      className="rounded-full px-2.5 py-1 text-[10.5px] font-semibold"
                      style={{
                        color: CONFIDENCE_TONE[d.confidence],
                        background: `color-mix(in srgb, ${CONFIDENCE_TONE[d.confidence]} 12%, transparent)`,
                      }}
                    >
                      {d.confidence} confidence
                    </span>
                  </div>
                  <h3 className="text-[14px] font-semibold leading-snug">{d.name}</h3>
                  <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
                    {d.agency} · {d.category.replace(/_/g, " ")}
                  </p>
                  <div className="mt-auto pt-3">
                    <p className="text-[11.5px] text-[var(--fg-muted)]">
                      {formatNumber(d.records)} records · updated {d.updated} ·{" "}
                      <span
                        className={
                          d.status === "active" ? "text-[var(--risk-low)]" : "text-[var(--risk-medium)]"
                        }
                      >
                        {d.status.replace(/_/g, " ")}
                      </span>
                    </p>
                    <a
                      href={d.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="focus-ring mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-[var(--accent)] hover:underline"
                    >
                      Source <ExternalLink size={11} aria-hidden="true" />
                    </a>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </>
      )}

      {/* Footer note */}
      <GlassCard className="mt-6 px-5 py-4">
        <div className="flex items-start gap-2">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
          <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
            Trust Level 1 = Official government warning (PAGASA, PHIVOLCS, USGS, NOAA, GDACS).
            Trust Level 2 = UN-backed humanitarian reports (ReliefWeb, UNICEF, UNHCR).
            Trust Level 3 = Research-grade datasets (ACLED, UCDP, World Bank).
            Trust Level 4 = Regional/specialized ops (ICAO, EASA, Copernicus).
            Trust Level 5 = Manual curated uploads.
            When sources conflict, the higher-trust source takes precedence.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
