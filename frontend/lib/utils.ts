import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const RISK_COLORS: Record<string, string> = {
  green: "var(--risk-low)",
  yellow: "var(--risk-medium)",
  red: "var(--risk-high)",
  gray: "var(--risk-nodata)",
};

export function riskColor(color?: string | null) {
  return RISK_COLORS[color ?? "gray"] ?? RISK_COLORS.gray;
}

/** Capture the visible MapLibre canvas as a downscaled PNG data URL for PDF
 * map snapshots. Returns undefined when no map is on screen. */
export function captureMapSnapshot(maxWidth = 1100): string | undefined {
  const canvas = document.querySelector<HTMLCanvasElement>(".maplibregl-canvas");
  if (!canvas || canvas.width === 0) return undefined;
  try {
    const scale = Math.min(1, maxWidth / canvas.width);
    const out = document.createElement("canvas");
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    out.getContext("2d")?.drawImage(canvas, 0, 0, out.width, out.height);
    const url = out.toDataURL("image/png");
    return url.length < 3_500_000 ? url : undefined;
  } catch {
    return undefined;
  }
}

export function formatNumber(n?: number | null) {
  if (n === null || n === undefined) return "—";
  return Intl.NumberFormat("en-US", { notation: n >= 10000 ? "compact" : "standard" }).format(n);
}
