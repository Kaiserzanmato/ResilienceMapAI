"use client";
import { memo } from "react";
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { axisProps, ChartCard, tooltipStyle } from "./ChartCard";
import { LocationComparisonCard } from "./LocationComparisonCard";
import { GlassCard } from "@/components/ui/GlassCard";
import { RiskBadge } from "@/components/ui/RiskBadge";
import { formatNumber, riskColor } from "@/lib/utils";

interface Stats {
  events_by_year: { year: number; events: number }[];
  top_locations: { name: string; country: string; score: number; level: string; color: string }[];
  exposure_by_sector: { sector: string; high: number; medium: number }[];
  alert_trend: { label: string; severity: string; rank: number }[];
  recent_events: { id: string; name: string; year: number; location: string; severity: string; source: string }[];
}

const SEVERITY_COLOR: Record<string, string> = {
  Low: "var(--risk-low)",
  Medium: "var(--risk-medium)",
  Moderate: "var(--risk-medium)",
  High: "var(--risk-high)",
  Critical: "var(--risk-high)",
};

function HistoricalEventsChart({ data }: { data: Stats["events_by_year"] }) {
  return (
    <ChartCard title="Historical Events by Year" sub="Recorded major disasters in the sample dataset" className="lg:col-span-2" index={2}>
      <ResponsiveContainer width="100%" height={230}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="evGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="year" {...axisProps} />
          <YAxis {...axisProps} allowDecimals={false} width={24} />
          <Tooltip {...tooltipStyle} />
          <Area
            type="monotone" dataKey="events" name="Events"
            stroke="var(--chart-1)" strokeWidth={2.5} fill="url(#evGrad)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function TopLocationsChart({ data }: { data: Stats["top_locations"] }) {
  return (
    <ChartCard title="Top High-Risk Locations" sub="Ranked by overall score" index={3}>
      <ul className="space-y-2">
        {data.slice(0, 6).map((l, i) => (
          <li key={l.name} className="flex items-center gap-3">
            <span className="w-5 text-right text-[12px] font-semibold text-[var(--fg-muted)]">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{l.name}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_10%,transparent)]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${l.score}%`, background: riskColor(l.color) }}
                />
              </div>
            </div>
            <RiskBadge risk={{ score: l.score, level: l.level as never, color: l.color as never }} />
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function ExposureChart({ data }: { data: Stats["exposure_by_sector"] }) {
  return (
    <ChartCard title="Exposure by Sector" sub="Assets within high and medium risk zones" className="lg:col-span-2" index={4}>
      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={data} layout="vertical" barGap={2}>
          <XAxis type="number" {...axisProps} scale="sqrt" hide />
          <YAxis type="category" dataKey="sector" {...axisProps} width={110} />
          <Tooltip {...tooltipStyle} formatter={(v) => formatNumber(Number(v))} />
          <Bar dataKey="high" name="High risk" fill="var(--risk-high)" radius={[0, 6, 6, 0]} />
          <Bar dataKey="medium" name="Medium risk" fill="var(--risk-medium)" radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

function AlertSeverityChart({ data }: { data: Stats["alert_trend"] }) {
  return (
    <ChartCard title="Alert Severity" sub="Current official alerts by severity" index={5}>
      <ul className="space-y-3 pt-1">
        {data.map((a) => (
          <li key={a.label}>
            <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
              <span className="min-w-0 truncate font-medium">{a.label}</span>
              <span
                className="shrink-0 font-semibold"
                style={{ color: SEVERITY_COLOR[a.severity] ?? "var(--fg-muted)" }}
              >
                {a.severity}
              </span>
            </div>
            <div
              role="meter"
              aria-label={`${a.label} severity`}
              aria-valuenow={a.rank}
              aria-valuemin={0}
              aria-valuemax={4}
              className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_10%,transparent)]"
            >
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${(a.rank / 4) * 100}%`,
                  background: SEVERITY_COLOR[a.severity] ?? "var(--fg-muted)",
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

function RecentEventsChart({ data }: { data: Stats["recent_events"] }) {
  return (
    <ChartCard title="Recent Disaster Events" sub="From official records" index={7}>
      <ul className="space-y-2.5">
        {data.slice(0, 5).map((e) => (
          <li key={e.id} className="flex items-start gap-2.5 text-[12.5px]">
            <span
              aria-hidden="true"
              className="mt-1 h-2 w-2 shrink-0 rounded-full"
              style={{
                background: e.severity === "Critical" ? "var(--risk-high)" : "var(--risk-medium)",
              }}
            />
            <div className="min-w-0">
              <p className="font-medium leading-snug">{e.name}</p>
              <p className="text-[11px] text-[var(--fg-muted)]">
                {e.year} · {e.location} · {e.source}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </ChartCard>
  );
}

// Memoize all chart components
const MemoHistoricalEvents = memo(HistoricalEventsChart);
const MemoTopLocations = memo(TopLocationsChart);
const MemoExposure = memo(ExposureChart);
const MemoAlertSeverity = memo(AlertSeverityChart);
const MemoRecentEvents = memo(RecentEventsChart);

export default function DeferredCharts({ data }: { data: Stats }) {
  if (!data) return null;

  return (
    <>
      <MemoHistoricalEvents data={data.events_by_year} />
      <MemoTopLocations data={data.top_locations} />
      <MemoExposure data={data.exposure_by_sector} />
      <MemoAlertSeverity data={data.alert_trend} />
      <LocationComparisonCard index={6} className="lg:col-span-3" />
      <MemoRecentEvents data={data.recent_events} />
    </>
  );
}
