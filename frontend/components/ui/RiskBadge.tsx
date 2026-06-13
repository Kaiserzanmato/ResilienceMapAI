import { cn, riskColor } from "@/lib/utils";
import type { RiskLevel } from "@/lib/types";

/** Risk label always pairs color with icon + text (never color alone). */
export function RiskBadge({
  risk,
  showScore = true,
  className,
}: {
  risk: RiskLevel;
  showScore?: boolean;
  className?: string;
}) {
  const color = riskColor(risk.color);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        className
      )}
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
      }}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 rounded-full"
        style={{ background: color }}
      />
      {risk.level}
      {showScore && risk.score !== null && (
        <span className="opacity-80">· {risk.score}</span>
      )}
    </span>
  );
}
