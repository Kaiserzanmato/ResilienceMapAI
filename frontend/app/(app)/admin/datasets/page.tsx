"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Database, ExternalLink, Loader2, Plus } from "lucide-react";
import { useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";

const CONFIDENCE_TONE: Record<string, string> = {
  High: "var(--risk-low)",
  Medium: "var(--risk-medium)",
  Low: "var(--risk-high)",
};

const EMPTY_FORM = { name: "", agency: "", category: "flood", url: "", confidence: "Medium", records: 0 };

export default function DatasetsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["datasets"], queryFn: api.datasets });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Dataset <span className="text-gradient">Management</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">
            Source provenance for every score — official agencies only, metadata-validated.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="focus-ring flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[var(--accent)] px-4 text-[13px] font-medium text-white hc:text-black shadow-[0_4px_20px_var(--accent-glow)] transition-all hover:brightness-110"
        >
          <Plus size={15} aria-hidden="true" /> Register dataset
        </button>
      </div>

      {message && (
        <GlassCard className="mb-4 flex items-center gap-2 px-4 py-3 text-[13px]">
          <CheckCircle2 size={15} className="text-[var(--risk-low)]" aria-hidden="true" />
          {message}
        </GlassCard>
      )}

      {showForm && (
        <GlassCard strong className="mb-4 p-5">
          <h2 className="mb-3 text-[14px] font-semibold">Register dataset metadata</h2>
          <p className="mb-4 text-[12px] text-[var(--fg-muted)]">
            Requires the <code className="rounded bg-[color-mix(in_srgb,var(--fg)_8%,transparent)] px-1.5 py-0.5">dataset_admin</code> role.
            Sources must be HTTPS and from trusted agencies (USGS, NOAA, PAGASA, PHIVOLCS, Copernicus…).
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
              <input required minLength={3} className={cn(inputCls, "mt-1")} value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="USGS Seismic Hazard Update" />
            </label>
            <label className="text-[12px] font-medium">
              Source agency
              <input required minLength={2} className={cn(inputCls, "mt-1")} value={form.agency}
                onChange={(e) => setForm({ ...form, agency: e.target.value })}
                placeholder="USGS" />
            </label>
            <label className="text-[12px] font-medium">
              Category
              <select className={cn(inputCls, "mt-1 cursor-pointer")} value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {["flood", "earthquake", "tropical_cyclone", "volcano", "landslide", "storm_surge", "multi"].map((c) => (
                  <option key={c} value={c}>{c.replace("_", " ")}</option>
                ))}
              </select>
            </label>
            <label className="text-[12px] font-medium">
              Confidence
              <select className={cn(inputCls, "mt-1 cursor-pointer")} value={form.confidence}
                onChange={(e) => setForm({ ...form, confidence: e.target.value })}>
                {["High", "Medium", "Low"].map((c) => <option key={c}>{c}</option>)}
              </select>
            </label>
            <label className="text-[12px] font-medium sm:col-span-2">
              Source URL (HTTPS required)
              <input required type="url" pattern="https://.*" className={cn(inputCls, "mt-1")} value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://earthquake.usgs.gov/…" />
            </label>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={upload.isPending}
                className="focus-ring flex h-10 cursor-pointer items-center gap-2 rounded-xl bg-[var(--accent)] px-5 text-[13px] font-medium text-white hc:text-black disabled:opacity-50">
                {upload.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                Register
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="focus-ring glass h-10 cursor-pointer rounded-xl px-5 text-[13px] font-medium">
                Cancel
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass h-40 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.datasets.map((d) => (
            <GlassCard key={d.id} className="flex flex-col p-5 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_36px_var(--accent-glow)]">
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
                {d.agency} · {d.category.replace("_", " ")}
              </p>
              <div className="mt-auto pt-3">
                <p className="text-[11.5px] text-[var(--fg-muted)]">
                  {formatNumber(d.records)} records · updated {d.updated} ·{" "}
                  <span className={d.status === "active" ? "text-[var(--risk-low)]" : "text-[var(--risk-medium)]"}>
                    {d.status.replace("_", " ")}
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
    </div>
  );
}
