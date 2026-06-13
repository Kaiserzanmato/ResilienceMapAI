"use client";
import { motion } from "framer-motion";
import { GlassCard } from "@/components/ui/GlassCard";

export function ChartCard({
  title,
  sub,
  children,
  className,
  index = 0,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.55, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <GlassCard className="h-full p-4 sm:p-5">
        <h3 className="text-[14px] font-semibold">{title}</h3>
        {sub && <p className="mb-3 mt-0.5 text-[11.5px] text-[var(--fg-muted)]">{sub}</p>}
        <div className="mt-2">{children}</div>
      </GlassCard>
    </motion.div>
  );
}

/** Shared Recharts tooltip styling matched to the design system. */
export const tooltipStyle = {
  contentStyle: {
    background: "var(--surface-solid)",
    border: "1px solid var(--surface-border)",
    borderRadius: 12,
    fontSize: 12,
    color: "var(--fg)",
    boxShadow: "0 12px 32px rgba(2,8,23,0.3)",
  },
  labelStyle: { color: "var(--fg)", fontWeight: 600 },
  itemStyle: { color: "var(--fg-muted)" },
  cursor: { fill: "color-mix(in srgb, var(--fg) 6%, transparent)" },
};

export const axisProps = {
  stroke: "var(--fg-muted)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;
