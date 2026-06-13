"use client";
import { Contrast, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

// Hydration-safe "mounted" flag without setState-in-effect
const emptySubscribe = () => () => {};
const useMounted = () =>
  useSyncExternalStore(emptySubscribe, () => true, () => false);

const OPTIONS = [
  { key: "light", label: "Light", icon: Sun },
  { key: "dark", label: "Dark", icon: Moon },
  { key: "system", label: "System", icon: Laptop },
  { key: "high-contrast", label: "High Contrast", icon: Contrast },
];

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const mounted = useMounted();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  if (!mounted) return <div className="h-10 w-10" />;

  const ActiveIcon =
    OPTIONS.find((o) => o.key === theme)?.icon ??
    (resolvedTheme === "dark" ? Moon : Sun);

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="Change theme"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="focus-ring glass flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-transform hover:scale-105"
      >
        <ActiveIcon size={17} aria-hidden="true" />
      </button>
      {open && (
        <div className="glass-strong absolute right-0 top-12 z-50 w-44 rounded-xl p-1.5">
          {OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => {
                setTheme(o.key);
                setOpen(false);
              }}
              className={cn(
                "focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]",
                theme === o.key && "text-[var(--accent)] font-semibold"
              )}
            >
              <o.icon size={15} aria-hidden="true" />
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
