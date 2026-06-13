"use client";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Markdown } from "@/components/ai/Markdown";
import { SourceGroundingCard } from "@/components/ai/SourceGroundingCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { api } from "@/lib/api";
import { riskColor } from "@/lib/utils";

export default function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-report", id],
    queryFn: () => api.sharedReport(id),
    retry: false,
  });

  if (isLoading) {
    return <div className="mx-auto max-w-3xl px-4"><div className="glass h-96 animate-pulse rounded-2xl" /></div>;
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-10 text-center">
        <GlassCard className="p-8">
          <h1 className="text-lg font-semibold">Report not found</h1>
          <p className="mt-2 text-[13px] text-[var(--fg-muted)]">
            This shared report link is invalid or has expired.
          </p>
          <Link href="/reports" className="focus-ring mt-5 inline-flex items-center gap-2 text-[13px] font-medium text-[var(--accent)] hover:underline">
            <ArrowLeft size={14} aria-hidden="true" /> Back to reports
          </Link>
        </GlassCard>
      </div>
    );
  }

  const { risk, summary, persona, sources, disclaimer, created_at } = data;

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20">
      <Link href="/reports" className="focus-ring mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]">
        <ArrowLeft size={14} aria-hidden="true" /> Reports
      </Link>

      <GlassCard strong className="overflow-hidden">
        <div className="border-b border-[var(--surface-border)] bg-gradient-to-r from-[color-mix(in_srgb,var(--accent)_10%,transparent)] to-[color-mix(in_srgb,var(--accent-2)_10%,transparent)] px-6 py-6">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[var(--fg-muted)]">
            ResilienceMap AI · Shared report
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{risk.location_name}</h1>
            <RiskBadge risk={risk.overall} />
          </div>
          <p className="mt-1 text-[12px] text-[var(--fg-muted)]">
            {risk.latitude.toFixed(4)}, {risk.longitude.toFixed(4)} · Persona:{" "}
            {persona.replace("_", " ")} · Generated {new Date(created_at).toLocaleString()}
          </p>
        </div>

        <div className="space-y-6 px-6 py-6">
          <section aria-label="Hazard breakdown">
            <h2 className="mb-3 text-[14px] font-semibold">Hazard breakdown</h2>
            <ul className="grid gap-2.5 sm:grid-cols-2">
              {Object.entries(risk.hazards).map(([key, h]) => (
                <li key={key} className="glass rounded-xl p-3">
                  <div className="flex items-center justify-between text-[12.5px]">
                    <span className="font-medium">{h.label}</span>
                    <span className="font-semibold" style={{ color: riskColor(h.color) }}>
                      {h.score === null ? "No data" : `${h.score} · ${h.level}`}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_10%,transparent)]">
                    <div className="h-full rounded-full" style={{ width: `${h.score ?? 0}%`, background: riskColor(h.color) }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section aria-label="AI summary">
            <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
              AI-generated summary
              <span className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--risk-low)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium text-[var(--risk-low)]">
                <ShieldCheck size={11} aria-hidden="true" /> Source-grounded
              </span>
            </h2>
            <div className="glass rounded-xl p-4">
              <Markdown text={summary} />
            </div>
          </section>

          <SourceGroundingCard sources={sources} />

          <p className="border-t border-[var(--surface-border)] pt-4 text-[11px] leading-relaxed text-[var(--fg-muted)]">
            {disclaimer} · {risk.methodology}
          </p>
        </div>
      </GlassCard>
    </div>
  );
}
