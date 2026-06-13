"use client";
import { useQuery } from "@tanstack/react-query";
import {
  FileDown, FileSpreadsheet, FileText, Link2, Loader2, MapPin,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SearchBar } from "@/components/map/SearchBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { api, downloadExport } from "@/lib/api";
import { getPersona, PERSONAS } from "@/lib/personas";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const REPORT_TYPES: Record<string, string> = {
  citizen: "Citizen Risk Summary",
  real_estate: "Real Estate Due Diligence Brief",
  insurance: "Insurance / Fintech Risk Memo",
  government: "Government Planning Brief",
  ngo: "NGO Priority Brief",
  business: "Business Continuity Brief",
  school: "School Safety Brief",
};

export default function ReportsPage() {
  const { selected, persona, setPersona } = useAppStore();
  const [busy, setBusy] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const active = getPersona(persona);

  const { data: recent, refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: api.reports,
  });

  const slug = (selected?.name ?? "location").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  async function run(kind: "pdf" | "csv" | "summary" | "share") {
    if (!selected) return;
    setBusy(kind);
    try {
      if (kind === "pdf") {
        await downloadExport("pdf", { ...selected, name: selected.name, persona }, `resiliencemap-${slug}.pdf`);
      } else if (kind === "summary") {
        await downloadExport("pdf", { ...selected, name: selected.name, persona: "executive" }, `resiliencemap-executive-${slug}.pdf`);
      } else if (kind === "csv") {
        await downloadExport("csv", { locations: [selected] }, `resiliencemap-${slug}.csv`);
      } else {
        const res = await api.shareLink({ ...selected, name: selected.name, persona });
        const url = `${window.location.origin}/reports/shared/${res.report_id}`;
        await navigator.clipboard.writeText(url).catch(() => {});
        setShareUrl(url);
        refetch();
      }
    } finally {
      setBusy(null);
    }
  }

  const exportOptions = [
    { key: "pdf" as const, icon: FileDown, title: "PDF Report", desc: REPORT_TYPES[persona] ?? "Persona-specific risk brief" },
    { key: "csv" as const, icon: FileSpreadsheet, title: "CSV Data", desc: "Structured hazard scores for analysis" },
    { key: "summary" as const, icon: FileText, title: "Executive Summary", desc: "Leadership-ready one-pager" },
    { key: "share" as const, icon: Link2, title: "Share Link", desc: "Hosted, read-only report link" },
  ];

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Reports & <span className="text-gradient">Exports</span>
        </h1>
        <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">
          Generate persona-specific briefs, structured data exports, and shareable report links.
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        <div className="space-y-3">
          {/* Step 1: location */}
          <GlassCard className="p-5">
            <h2 className="mb-1 flex items-center gap-2 text-[14px] font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white hc:text-black">1</span>
              Choose a location
            </h2>
            <p className="mb-3 text-[12px] text-[var(--fg-muted)]">
              Search, or pick a spot on the <Link href="/map" className="text-[var(--accent)] hover:underline">map</Link>.
            </p>
            <SearchBar />
            {selected && (
              <p className="mt-3 flex items-center gap-1.5 text-[13px]">
                <MapPin size={13} className="text-[var(--accent)]" aria-hidden="true" />
                <strong>{selected.name ?? `${selected.lat.toFixed(3)}, ${selected.lng.toFixed(3)}`}</strong>
              </p>
            )}
          </GlassCard>

          {/* Step 2: persona */}
          <GlassCard className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white hc:text-black">2</span>
              Report persona — {active.label}
            </h2>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Report persona">
              {PERSONAS.map((p) => (
                <button
                  key={p.key}
                  role="radio"
                  aria-checked={persona === p.key}
                  onClick={() => setPersona(p.key)}
                  className={cn(
                    "focus-ring cursor-pointer rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all",
                    persona === p.key
                      ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                      : "border-[var(--surface-border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                  )}
                >
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Step 3: export */}
          <GlassCard className="p-5">
            <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-[11px] font-bold text-white hc:text-black">3</span>
              Export
            </h2>
            {!selected && (
              <p className="mb-3 rounded-xl border border-[var(--risk-medium)] bg-[color-mix(in_srgb,var(--risk-medium)_10%,transparent)] px-3 py-2 text-[12px]">
                Select a location first to enable exports.
              </p>
            )}
            <div className="grid gap-2.5 sm:grid-cols-2">
              {exportOptions.map((o) => (
                <button
                  key={o.key}
                  onClick={() => run(o.key)}
                  disabled={!selected || busy !== null}
                  className="focus-ring glass group flex cursor-pointer items-start gap-3 rounded-xl p-4 text-left transition-all hover:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]">
                    {busy === o.key ? (
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <o.icon size={16} aria-hidden="true" />
                    )}
                  </span>
                  <span>
                    <span className="block text-[13.5px] font-semibold group-hover:text-[var(--accent)]">{o.title}</span>
                    <span className="block text-[11.5px] text-[var(--fg-muted)]">{o.desc}</span>
                  </span>
                </button>
              ))}
            </div>
            {shareUrl && (
              <p className="mt-3 rounded-xl border border-[var(--risk-low)] bg-[color-mix(in_srgb,var(--risk-low)_10%,transparent)] px-3 py-2 text-[12px]">
                Link copied:{" "}
                <a href={shareUrl} className="font-medium text-[var(--accent)] hover:underline">
                  {shareUrl}
                </a>
              </p>
            )}
          </GlassCard>
        </div>

        {/* Recent shared reports */}
        <GlassCard className="h-fit p-5">
          <h2 className="mb-3 text-[14px] font-semibold">Recent shared reports</h2>
          {!recent?.reports.length ? (
            <p className="text-[12.5px] text-[var(--fg-muted)]">
              No shared reports yet. Generate a share link and it will appear here.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {recent.reports.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reports/shared/${r.id}`}
                    className="focus-ring glass flex cursor-pointer items-center gap-3 rounded-xl p-3 transition-all hover:border-[var(--accent)]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium">{r.location}</p>
                      <p className="text-[11px] text-[var(--fg-muted)]">
                        {r.persona.replace("_", " ")} · {new Date(r.created_at).toLocaleString()}
                      </p>
                    </div>
                    <RiskBadge risk={r.overall as never} showScore={false} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </div>
  );
}
