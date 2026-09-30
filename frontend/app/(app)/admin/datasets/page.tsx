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
  Info,
  Search,
  X,
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

// Canonical tiers — mirrors TrustTier in backend/app/data_sources/registry/sources_registry.py.
const TRUST_LABEL: Record<number, string> = {
  1: "Official agency",
  2: "UN / humanitarian",
  3: "Research-grade",
  4: "Regional / specialised",
  5: "User upload",
};

const SYNC_STATUS_COLOR: Record<string, string> = {
  success: "var(--risk-low)",
  failed: "var(--risk-high)",
  partial: "var(--risk-medium)",
  disabled: "var(--fg-muted)",
  never: "var(--fg-muted)",
  not_configured: "var(--fg-muted)",
};

const EMPTY_FORM = {
  name: "",
  agency: "",
  category: "flood",
  url: "",
  confidence: "Medium",
  records: 0,
  license: "",
  adminKey: "",
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
  /** Closed-vocabulary reason for the last failure (never a raw upstream error). */
  reason_code: string | null;
  error: string | null;
  is_stale: boolean;
  source_url: string;
  docs_url: string | null;
  requires_api_key: boolean;
  requires_registration: boolean;
  license_notes: string | null;
}

interface SyncUpdateSource {
  name: string;
  status: string | null;
  records: number;
  lastSync: string | null;
}

interface SyncUpdates {
  timestamp: number;
  previousCount: number;
  currentCount: number;
  changedSources: SyncUpdateSource[];
}

async function fetchSyncHealth(): Promise<{ sync_health: SyncHealthEntry[] }> {
  const res = await fetch(`${API_BASE}/api/sync-health`);
  if (!res.ok) throw new Error("Failed to load sync health");
  return res.json();
}

interface DataStatus {
  last_sync_timestamp: string | null;
  data_version: string;
}

async function fetchDataStatus(): Promise<DataStatus> {
  const res = await fetch(`${API_BASE}/api/data-status`);
  if (!res.ok) throw new Error("Failed to load data status");
  return res.json();
}

// Everything derived from synced data; refetched after a successful sync so the
// map, layers and assessments never keep serving pre-sync results.
const SYNC_DEPENDENT_QUERY_KEYS = ["zones", "heat", "current-events", "hazard-events", "assessment"] as const;

export default function DatasetsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["datasets"], queryFn: api.datasets });
  const { data: syncData, isLoading: syncLoading, refetch: refetchSyncHealth } = useQuery({
    queryKey: ["sync-health"],
    queryFn: fetchSyncHealth,
    enabled: FLAGS.SOURCE_HEALTH_MONITORING,
    refetchInterval: 60_000,
  });
  // Freshness comes from the server (last successful sync), never from a client timestamp.
  const { data: dataStatus } = useQuery({
    queryKey: ["data-status"],
    queryFn: fetchDataStatus,
    enabled: FLAGS.SOURCE_HEALTH_MONITORING,
    refetchInterval: 60_000,
  });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sources" | "datasets">(
    FLAGS.SOURCE_HEALTH_MONITORING ? "sources" : "datasets"
  );
  const [showUpdates, setShowUpdates] = useState(false);
  // Session-only diff of the last manual refresh; deliberately not persisted.
  const [lastUpdates, setLastUpdates] = useState<SyncUpdates | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const handleRefresh = async () => {
    const prevData = syncData?.sync_health ?? [];
    try {
      const [{ data: newData }] = await Promise.all([refetchSyncHealth(), qc.invalidateQueries({ queryKey: ["data-status"] })]);
      if (newData?.sync_health) {
        setLastUpdates({
          timestamp: Date.now(),
          previousCount: prevData.length,
          currentCount: newData.sync_health.length,
          changedSources: newData.sync_health.filter((s) => {
            const prev = prevData.find((p) => p.source_id === s.source_id);
            return prev && (
              prev.last_sync_status !== s.last_sync_status ||
              prev.records_synced !== s.records_synced ||
              prev.last_successful_sync_at !== s.last_successful_sync_at
            );
          }).map((s) => ({
            name: s.source_name,
            status: s.last_sync_status,
            records: s.records_synced,
            lastSync: s.last_successful_sync_at,
          })),
        });
        setMessage("Sync status refreshed. No source synchronization was triggered.");
        setTimeout(() => setMessage(null), 5000);
      }
    } catch (error) {
      setMessage(`Refresh failed: ${(error as Error).message}`);
      setTimeout(() => setMessage(null), 5000);
    }
  };

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

  const [showSyncKeyInput, setShowSyncKeyInput] = useState(false);
  const [syncAdminKey, setSyncAdminKey] = useState("");
  const sync = useMutation({
    mutationFn: api.triggerSync,
    onSuccess: (res) => {
      setMessage(res.message);
      setShowSyncKeyInput(false);
      setSyncAdminKey("");
      qc.invalidateQueries({ queryKey: ["sync-health"] });
      qc.invalidateQueries({ queryKey: ["data-status"] });
      for (const key of SYNC_DEPENDENT_QUERY_KEYS) qc.invalidateQueries({ queryKey: [key] });
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (e) => setMessage(`Sync failed: ${(e as Error).message}`),
  });

  const [reviewAdminKey, setReviewAdminKey] = useState("");
  // Pending/rejected uploads are admin-only; this loads only on demand with the admin key.
  const {
    data: adminData,
    refetch: loadAdminDatasets,
    isFetching: adminLoading,
    error: adminError,
  } = useQuery({
    queryKey: ["admin-datasets"],
    queryFn: () => api.adminDatasets(reviewAdminKey),
    enabled: false,
    retry: false,
  });
  const pendingUploads = adminData?.datasets.filter((d) => d.review_status === "pending") ?? [];
  const review = useMutation({
    mutationFn: (v: { id: string; decision: "approved" | "rejected" }) =>
      api.reviewDataset(v.id, v.decision, reviewAdminKey),
    onSuccess: (res) => {
      setMessage(res.message);
      qc.invalidateQueries({ queryKey: ["datasets"] });
      loadAdminDatasets();
      setTimeout(() => setMessage(null), 5000);
    },
    onError: (e) => setMessage(`Review failed: ${(e as Error).message}`),
  });

  const inputCls =
    "focus-ring w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-solid)] px-3 py-2.5 text-[13.5px] placeholder:text-[var(--fg-muted)]";

  const syncEntries = syncData?.sync_health ?? [];
  const staleSources = syncEntries.filter((s) => s.is_stale && s.enabled);
  const failedSources = syncEntries.filter((s) => s.last_sync_status === "failed");

  // Filter entries based on search query
  const filteredSyncEntries = syncEntries.filter((s) =>
    s.source_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.organization.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.coverage.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.domains.some((d: string) => d.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredDatasets = data?.datasets.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.agency.toLowerCase().includes(searchQuery.toLowerCase()) ||
    d.category.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 sm:px-6 md:px-8 pb-20 overflow-x-hidden">
      {/* Header */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Dataset <span className="text-gradient">Management</span>
            </h1>
            <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">
              Global source registry — official agencies, sync health, and approved data provenance.
            </p>
          </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {FLAGS.SOURCE_HEALTH_MONITORING && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRefresh}
                  disabled={syncLoading}
                  title="Refresh sync status"
                  className="focus-ring glass flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {syncLoading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Refreshing status
                    </>
                  ) : (
                    <>
                      <RefreshCw size={14} aria-hidden="true" /> Refresh Status
                    </>
                  )}
                </button>
                <button
                  onClick={() => setShowUpdates(!showUpdates)}
                  className="focus-ring glass flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  title="View what data was updated"
                >
                  <Info size={14} aria-hidden="true" /> What&apos;s New
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowSyncKeyInput((v) => !v)}
                    disabled={sync.isPending}
                    title="Trigger a real sync against live source feeds (requires admin key)"
                    className="focus-ring glass flex h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sync.isPending ? (
                      <>
                        <Loader2 size={14} className="animate-spin" aria-hidden="true" /> Syncing
                      </>
                    ) : (
                      <>
                        <Database size={14} aria-hidden="true" /> Sync Now
                      </>
                    )}
                  </button>
                  {showSyncKeyInput && (
                    <div className="glass-strong absolute right-0 top-full z-20 mt-2 w-72 rounded-xl p-3">
                      <p className="mb-2 text-[11.5px] text-[var(--fg-muted)]">
                        Triggers a live sync for wired sources (USGS, GDACS, NASA EONET, ReliefWeb). Requires the server admin key.
                      </p>
                      <form
                        className="flex gap-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (syncAdminKey) sync.mutate(syncAdminKey);
                        }}
                      >
                        <input
                          required
                          type="password"
                          autoComplete="off"
                          autoFocus
                          className={cn(inputCls, "flex-1")}
                          value={syncAdminKey}
                          onChange={(e) => setSyncAdminKey(e.target.value)}
                          placeholder="Admin key"
                        />
                        <button
                          type="submit"
                          disabled={sync.isPending}
                          className="focus-ring shrink-0 cursor-pointer rounded-xl bg-[var(--accent)] px-3 text-[13px] font-medium text-white hc:text-black disabled:opacity-50"
                        >
                          Go
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
              {dataStatus && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] border border-[var(--surface-border)]">
                  <Clock size={14} className="text-[var(--accent)]" />
                  <div className="text-[12px]">
                    <span className="text-[var(--fg-muted)]">Last successful sync (server): </span>
                    <span className="font-medium text-[var(--fg)]">
                      {dataStatus.last_sync_timestamp ? new Date(dataStatus.last_sync_timestamp).toLocaleString() : "No sync has completed yet"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
          <button
            onClick={() => setShowForm((v) => !v)}
            className="focus-ring flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-medium text-white hc:text-black shadow-[0_4px_20px_var(--accent-glow)] transition-all hover:brightness-110"
          >
            <Plus size={15} aria-hidden="true" /> Register dataset
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative w-full sm:max-w-md">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)]" />
            <input
              type="text"
              placeholder="Search sources, datasets, agencies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="focus-ring w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface-solid)] pl-9 pr-9 py-2.5 text-[13px] placeholder:text-[var(--fg-muted)] transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
                title="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-[11px] text-[var(--fg-muted)]">
              {activeTab === "sources" ? `${filteredSyncEntries.length} source(s) found` : `${filteredDatasets.length} dataset(s) found`}
            </p>
          )}
        </div>
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

      {/* What's New Section */}
      {showUpdates && lastUpdates && (
        <GlassCard className="mb-4 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold">What&apos;s New</h3>
            <button
              onClick={() => setShowUpdates(false)}
              className="text-[var(--fg-muted)] hover:text-[var(--fg)] transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-3 text-[13px]">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--surface-border)]">
              <span className="text-[var(--fg-muted)]">Last updated:</span>
              <span className="font-medium">{new Date(lastUpdates.timestamp).toLocaleString()}</span>
            </div>
            {lastUpdates.changedSources && lastUpdates.changedSources.length > 0 ? (
              <div>
                <p className="text-[var(--fg-muted)] mb-2">
                  <strong>{lastUpdates.changedSources.length} data source(s) updated:</strong>
                </p>
                <ul className="space-y-2">
                  {lastUpdates.changedSources.map((source, idx) => (
                    <li key={idx} className="flex items-start gap-2 p-2 rounded bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]">
                      <CheckCircle2 size={14} className="text-[var(--risk-low)] mt-0.5 shrink-0" />
                      <div>
                        <p className="font-medium">{source.name}</p>
                        <p className="text-[11px] text-[var(--fg-muted)]">
                          Status: {source.status} · Records: {formatNumber(source.records)} · Last sync: {source.lastSync ? new Date(source.lastSync).toLocaleString() : 'Never'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-[var(--fg-muted)]">No changes detected in the last update.</p>
            )}
          </div>
        </GlassCard>
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
            Requires the admin key below (matches the server&apos;s{" "}
            <code className="rounded bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-1.5 py-0.5">
              ADMIN_SHARED_SECRET
            </code>
            ). Sources must be HTTPS and from trusted agencies (USGS, NOAA, PAGASA, PHIVOLCS, Copernicus…).
            Registered datasets are tier 5 (user upload) and stay pending until reviewed; only approved datasets can affect scoring or AI answers.
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
            <label className="text-[12px] font-medium sm:col-span-2">
              License (optional)
              <input
                className={cn(inputCls, "mt-1")}
                value={form.license}
                onChange={(e) => setForm({ ...form, license: e.target.value })}
                placeholder="e.g. CC BY 4.0"
              />
            </label>
            <label className="text-[12px] font-medium sm:col-span-2">
              Admin key
              <input
                required
                type="password"
                autoComplete="off"
                className={cn(inputCls, "mt-1")}
                value={form.adminKey}
                onChange={(e) => setForm({ ...form, adminKey: e.target.value })}
                placeholder="Server ADMIN_SHARED_SECRET"
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
          ) : filteredSyncEntries.length === 0 && searchQuery ? (
            <GlassCard className="p-8 text-center">
              <p className="text-[var(--fg-muted)]">No sources match your search for &quot;{searchQuery}&quot;</p>
            </GlassCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSyncEntries.map((s) => (
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
                        {(s.last_sync_status ?? "never").replace(/_/g, " ")}
                      </span>
                    </div>
                    {s.last_sync_status === "failed" && s.error && (
                      <div className="flex items-start justify-between gap-2">
                        <span>Reason</span>
                        <span className="text-right font-medium text-[var(--risk-high)]">{s.error}</span>
                      </div>
                    )}
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
          <GlassCard className="mb-4 p-4">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="text-[var(--fg-muted)]">
                Pending uploads are visible to admins only. Admin key:
              </span>
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (reviewAdminKey) loadAdminDatasets();
                }}
              >
                <input
                  type="password"
                  autoComplete="off"
                  className={cn(inputCls, "w-56")}
                  value={reviewAdminKey}
                  onChange={(e) => setReviewAdminKey(e.target.value)}
                  placeholder="Server ADMIN_SHARED_SECRET"
                />
                <button
                  type="submit"
                  disabled={!reviewAdminKey || adminLoading}
                  className="focus-ring cursor-pointer rounded-xl bg-[var(--accent)] px-3 py-2 text-[12.5px] font-medium text-white hc:text-black disabled:opacity-50"
                >
                  {adminLoading ? "Loading…" : "Load pending"}
                </button>
              </form>
            </div>
            {adminError && (
              <p className="mt-2 text-[12px] text-[var(--risk-high)]">
                Could not load uploads: {(adminError as Error).message}
              </p>
            )}
            {adminData && pendingUploads.length === 0 && (
              <p className="mt-2 text-[12px] text-[var(--fg-muted)]">No uploads are waiting for review.</p>
            )}
            {pendingUploads.length > 0 && (
              <ul className="mt-3 space-y-2">
                {pendingUploads.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--surface-border)] px-3 py-2"
                  >
                    <div className="min-w-0 text-[12.5px]">
                      <p className="truncate font-medium">{d.name}</p>
                      <p className="text-[11.5px] text-[var(--fg-muted)]">
                        {d.agency} · {d.category.replace(/_/g, " ")} · Tier {d.trust_level} ({TRUST_LABEL[d.trust_level ?? 5]}) ·{" "}
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
                          Source
                        </a>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: d.id, decision: "approved" })}
                        className="focus-ring cursor-pointer rounded-lg border border-[var(--surface-border)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--risk-low)] disabled:opacity-50"
                      >
                        Approve
                      </button>
                      <button
                        disabled={review.isPending}
                        onClick={() => review.mutate({ id: d.id, decision: "rejected" })}
                        className="focus-ring cursor-pointer rounded-lg border border-[var(--surface-border)] px-2.5 py-1 text-[11.5px] font-medium text-[var(--risk-high)] disabled:opacity-50"
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="glass h-40 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : filteredDatasets.length === 0 && searchQuery ? (
            <GlassCard className="p-8 text-center">
              <p className="text-[var(--fg-muted)]">No datasets match your search for &quot;{searchQuery}&quot;</p>
            </GlassCard>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredDatasets.map((d) => (
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
                      {d.trust_level ? ` · Tier ${d.trust_level} (${TRUST_LABEL[d.trust_level] ?? "Unknown"})` : ""}
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
            Tier 1 = Official agencies (PAGASA, PHIVOLCS, USGS, NOAA, GDACS).
            Tier 2 = UN and humanitarian bodies (ReliefWeb, UNICEF, UNHCR).
            Tier 3 = Research-grade datasets (ACLED, UCDP, World Bank).
            Tier 4 = Regional and specialised sources (ICAO, EASA, Copernicus).
            Tier 5 = User uploads; pending until reviewed, and never used for scoring or AI until approved.
            When sources conflict, the higher-trust source takes precedence.
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
