"use client";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";
import { getPersona, PERSONAS } from "@/lib/personas";
import { getPersonaIcon } from "@/components/persona-icons";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { GlassMenu } from "@/components/ui/GlassMenu";
import { Icon } from "@/components/ui/Icon";
import { IconTile } from "@/components/ui/IconTile";

export function PersonaSelector({ compact = false }: { compact?: boolean }) {
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const setPersonaMenuOpen = useAppStore((s) => s.setPersonaMenuOpen);
  const [open, setOpen] = useState(false);
  const active = getPersona(persona);
  const ActiveIcon = getPersonaIcon(persona);

  useEffect(() => {
    setPersonaMenuOpen(open);
    // Only this effect owns clearing the flag on unmount — safe even if a
    // page without RiskSummaryWidget never reads it.
    return () => {
      if (open) setPersonaMenuOpen(false);
    };
  }, [open, setPersonaMenuOpen]);

  return (
    <GlassMenu
      open={open}
      onOpenChange={setOpen}
      label="Insight persona"
      className="w-64"
      trigger={
        <button
          aria-label={`Persona: ${active.label}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring glass flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium transition-transform hover:scale-[1.02]"
        >
          <Icon icon={ActiveIcon} size="inline" />
          {!compact && <span className="hidden sm:inline">{active.label}</span>}
          <ChevronDown size={14} className="opacity-60" aria-hidden="true" />
        </button>
      }
    >
      {/* Solid background (not the usual translucent glass-strong) — this
          dropdown sits directly over the "Run Risk Audit" CTA on /agents,
          and glass-strong's ~12% transparency let the CTA's glow bleed
          through visibly while the menu was open. */}
      <div style={{ background: "var(--surface-solid)" }} className="-m-1.5 rounded-xl p-1.5">
        <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
          Insight persona
        </p>
        {PERSONAS.map((p) => {
          const selected = persona === p.key;
          return (
            <button
              key={p.key}
              role="menuitem"
              onClick={() => {
                setPersona(p.key);
                setOpen(false);
              }}
              className={cn(
                "focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]",
                selected && "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
              )}
            >
              <IconTile icon={getPersonaIcon(p.key)} active={selected} />
              <span>
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-[var(--fg-muted)]">{p.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </GlassMenu>
  );
}
