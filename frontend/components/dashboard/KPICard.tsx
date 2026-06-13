"use client";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export function KPICard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "var(--accent)",
  index = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  tone?: string;
  index?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassCard className="group h-full p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_var(--accent-glow)] sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[12px] font-medium text-[var(--fg-muted)]">{label}</p>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
            style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
          >
            <Icon size={15} />
          </span>
        </div>
        <p className="mt-1.5 text-[26px] font-semibold leading-none tracking-tight sm:text-[30px]">
          {value}
        </p>
        {sub && <p className="mt-1.5 text-[11.5px] text-[var(--fg-muted)]">{sub}</p>}
      </GlassCard>
    </motion.div>
  );
}
