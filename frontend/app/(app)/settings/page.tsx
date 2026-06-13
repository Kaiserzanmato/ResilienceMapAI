"use client";
import { Contrast, Laptop, Moon, Palette, ShieldCheck, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { MAP_VIEWS } from "@/lib/mapStyles";
import { getPersona, PERSONAS } from "@/lib/personas";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const THEMES = [
  { key: "light", label: "Light", icon: Sun, desc: "Clean, public-friendly" },
  { key: "dark", label: "Dark", icon: Moon, desc: "Command center" },
  { key: "system", label: "System", icon: Laptop, desc: "Follow OS preference" },
  { key: "high-contrast", label: "High Contrast", icon: Contrast, desc: "Maximum legibility" },
];

const emptySubscribe = () => () => {};

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { persona, setPersona, mapView, setMapView } = useAppStore();
  // Hydration-safe mounted flag without setState-in-effect
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-20">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">
          Appearance, default persona, and platform preferences. Stored locally on this device.
        </p>
      </div>

      <div className="space-y-3">
        <GlassCard className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
            <Palette size={15} className="text-[var(--accent)]" aria-hidden="true" /> Appearance
          </h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Theme">
            {THEMES.map((t) => (
              <button
                key={t.key}
                role="radio"
                aria-checked={mounted && theme === t.key}
                onClick={() => setTheme(t.key)}
                className={cn(
                  "focus-ring flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border p-4 text-center transition-all",
                  mounted && theme === t.key
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                    : "border-[var(--surface-border)] hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
                )}
              >
                <t.icon size={18} aria-hidden="true" />
                <span className="text-[13px] font-medium">{t.label}</span>
                <span className="text-[10.5px] text-[var(--fg-muted)]">{t.desc}</span>
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
            <User size={15} className="text-[var(--accent)]" aria-hidden="true" /> Default persona
          </h2>
          <p className="mb-3 text-[12px] text-[var(--fg-muted)]">
            AI insights, suggested queries, and report templates adapt to this persona.
            Current: <strong className="text-[var(--fg)]">{getPersona(persona).label}</strong>
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Default persona">
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

        <GlassCard className="p-5">
          <h2 className="mb-3 text-[14px] font-semibold">Default map view</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6" role="radiogroup" aria-label="Default map view">
            {MAP_VIEWS.map((v) => (
              <button
                key={v.key}
                role="radio"
                aria-checked={mapView === v.key}
                onClick={() => setMapView(v.key)}
                className={cn(
                  "focus-ring cursor-pointer rounded-xl border px-2 py-2.5 text-[12px] font-medium transition-all",
                  mapView === v.key
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[var(--accent)]"
                    : "border-[var(--surface-border)] text-[var(--fg-muted)] hover:text-[var(--fg)]"
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold">
            <ShieldCheck size={15} className="text-[var(--risk-low)]" aria-hidden="true" /> Privacy & trust
          </h2>
          <ul className="space-y-1.5 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            <li>• All AI calls run server-side — no API keys ever reach your browser.</li>
            <li>• Risk scores are deterministic engine output; the AI explains but never decides them.</li>
            <li>• Every insight cites official sources with update dates and confidence levels.</li>
            <li>• Requests are rate-limited and audit-logged for accountability.</li>
            <li>• This platform provides indicative intelligence — not official advisories.</li>
          </ul>
        </GlassCard>
      </div>
    </div>
  );
}
