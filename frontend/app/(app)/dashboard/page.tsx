"use client";
import { useQuery } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import { Suspense } from "react";
import {
  Activity, AlertTriangle, Building2, GraduationCap, Hospital, MapPin,
  ShieldAlert, Users,
} from "lucide-react";
import Link from "next/link";
import {
  Cell, Pie, PieChart, ResponsiveContainer, Tooltip,
  Bar, BarChart, XAxis, YAxis,
} from "recharts";
import { axisProps, ChartCard, tooltipStyle } from "@/components/dashboard/ChartCard";
import { KPICard } from "@/components/dashboard/KPICard";
import { GlassCard } from "@/components/ui/GlassCard";
import { API_BASE } from "@/lib/api";
import { formatNumber, riskColor } from "@/lib/utils";

// Lazy load below-the-fold charts
const DeferredCharts = dynamic(
  () => import("@/components/dashboard/DeferredCharts"),
  { ssr: false, loading: () => null }
);

interface Stats {
  kpis: {
    average_risk: number; high_risk_areas: number; active_alerts: number;
    main_driver: string; population_exposed: number;
    critical_facilities_exposed: number; schools_exposed: number;
    hospitals_exposed: number;
  };
  risk_distribution: { level: string; count: number; color: string }[];
  hazard_breakdown: { hazard: string; average: number; max: number }[];
  events_by_year: { year: number; events: number }[];
  top_locations: { name: string; country: string; score: number; level: string; color: string }[];
  exposure_by_sector: { sector: string; high: number; medium: number }[];
  alert_trend: { label: string; severity: string; rank: number }[];
  recent_events: { id: string; name: string; year: number; location: string; severity: string; source: string }[];
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/dashboard-stats`);
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
  });

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-[1500px] px-4 pb-16">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass h-32 animate-pulse rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const k = data.kpis;
  const kpis = [
    { label: "Average Risk Score", value: `${k.average_risk}`, sub: "across monitored areas · 0–100", icon: Activity, tone: "var(--accent)" },
    { label: "High-Risk Areas", value: `${k.high_risk_areas}`, sub: "zones scoring 61+", icon: ShieldAlert, tone: "var(--risk-high)" },
    { label: "Active Alerts", value: `${k.active_alerts}`, sub: "from official agencies", icon: AlertTriangle, tone: "var(--risk-medium)" },
    { label: "Main Hazard Driver", value: k.main_driver, sub: "highest average exposure", icon: MapPin, tone: "var(--accent-2)" },
    { label: "Population Exposed", value: formatNumber(k.population_exposed), sub: "in high-risk zones", icon: Users, tone: "var(--accent)" },
    { label: "Critical Facilities", value: formatNumber(k.critical_facilities_exposed), sub: "exposed in high-risk zones", icon: Building2, tone: "var(--risk-high)" },
    { label: "Schools Exposed", value: formatNumber(k.schools_exposed), sub: "in high-risk zones", icon: GraduationCap, tone: "var(--accent-2)" },
    { label: "Hospitals Exposed", value: formatNumber(k.hospitals_exposed), sub: "in high-risk zones", icon: Hospital, tone: "var(--risk-medium)" },
  ];

  return (
    <div className="mx-auto max-w-[1500px] px-4 pb-20">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Executive <span className="text-gradient">Dashboard</span>
          </h1>
          <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">
            Multi-hazard intelligence across monitored areas — deterministic scores, official sources.
          </p>
        </div>
        <Link
          href="/reports"
          className="focus-ring glass flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-medium transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Generate report →
        </Link>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <KPICard key={kpi.label} {...kpi} index={i} />
        ))}
      </div>

      {/* Critical charts above the fold */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ChartCard title="Risk Distribution" sub="Monitored areas by risk level" index={0}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data.risk_distribution}
                dataKey="count"
                nameKey="level"
                innerRadius={62}
                outerRadius={90}
                paddingAngle={4}
                strokeWidth={0}
                label={(props) => {
                  const p = props.payload as { level: string; count: number } | undefined;
                  return p ? `${p.level}: ${p.count}` : "";
                }}
                isAnimationActive
              >
                {data.risk_distribution.map((d) => (
                  <Cell key={d.level} fill={riskColor(d.color)} />
                ))}
              </Pie>
              <Tooltip {...tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Hazard Breakdown" sub="Average vs. peak score per hazard" className="lg:col-span-2" index={1}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data.hazard_breakdown} barGap={2}>
              <XAxis dataKey="hazard" {...axisProps} interval={0} tick={{ fontSize: 10 }} />
              <YAxis {...axisProps} domain={[0, 100]} width={28} />
              <Tooltip {...tooltipStyle} />
              <Bar dataKey="average" name="Average" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
              <Bar dataKey="max" name="Peak" fill="var(--chart-2)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Lazy-load below-the-fold charts */}
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <DeferredCharts data={data} />
      </div>

      <GlassCard className="mt-4 px-5 py-4">
        <p className="text-[11.5px] leading-relaxed text-[var(--fg-muted)]">
          Scores are computed deterministically from official public datasets (USGS, NOAA, PAGASA,
          PHIVOLCS, Copernicus, World Bank). Indicative intelligence only — not an official advisory
          or prediction system.
        </p>
      </GlassCard>
    </div>
  );
}
