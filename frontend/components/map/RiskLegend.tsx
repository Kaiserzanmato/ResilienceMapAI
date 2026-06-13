import { GlassCard } from "@/components/ui/GlassCard";

const ITEMS = [
  { label: "Low Risk (0–25)", color: "var(--risk-low)" },
  { label: "Medium Risk (26–60)", color: "var(--risk-medium)" },
  { label: "High Risk (61–100)", color: "var(--risk-high)" },
  { label: "No Data", color: "var(--risk-nodata)" },
];

export function RiskLegend() {
  return (
    <GlassCard className="px-3.5 py-2.5" aria-label="Risk legend">
      <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
        Risk legend
      </p>
      <ul className="space-y-1">
        {ITEMS.map((i) => (
          <li key={i.label} className="flex items-center gap-2 text-[12px] font-medium">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: i.color }}
            />
            {i.label}
          </li>
        ))}
      </ul>
    </GlassCard>
  );
}
