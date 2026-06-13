"use client";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getPersona, PERSONAS } from "@/lib/personas";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function PersonaSelector({ compact = false }: { compact?: boolean }) {
  const persona = useAppStore((s) => s.persona);
  const setPersona = useAppStore((s) => s.setPersona);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = getPersona(persona);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label={`Persona: ${active.label}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring glass flex h-10 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-medium transition-transform hover:scale-[1.02]"
      >
        <span aria-hidden="true">{active.emoji}</span>
        {!compact && <span className="hidden sm:inline">{active.label}</span>}
        <ChevronDown size={14} className="opacity-60" aria-hidden="true" />
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-12 z-50 w-64 rounded-xl p-1.5">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
            Insight persona
          </p>
          {PERSONAS.map((p) => (
            <button
              key={p.key}
              onClick={() => {
                setPersona(p.key);
                setOpen(false);
              }}
              className={cn(
                "focus-ring flex w-full cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]",
                persona === p.key && "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
              )}
            >
              <span aria-hidden="true" className="mt-0.5">{p.emoji}</span>
              <span>
                <span className="block text-sm font-medium">{p.label}</span>
                <span className="block text-xs text-[var(--fg-muted)]">{p.description}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
