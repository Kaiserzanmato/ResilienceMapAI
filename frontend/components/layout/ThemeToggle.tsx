"use client";
import { Contrast, Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { GlassMenu } from "@/components/ui/GlassMenu";
import { Icon } from "@/components/ui/Icon";

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

  if (!mounted) return <div className="h-10 w-10" />;

  const ActiveIcon =
    OPTIONS.find((o) => o.key === theme)?.icon ??
    (resolvedTheme === "dark" ? Moon : Sun);

  return (
    <GlassMenu
      open={open}
      onOpenChange={setOpen}
      label="Change theme"
      className="w-44"
      trigger={
        <button
          aria-label="Change theme"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="focus-ring glass flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl transition-transform hover:scale-105"
        >
          <Icon icon={ActiveIcon} size="inline" />
        </button>
      }
    >
      {OPTIONS.map((o) => (
        <button
          key={o.key}
          role="menuitem"
          onClick={() => {
            setTheme(o.key);
            setOpen(false);
          }}
          className={cn(
            "focus-ring flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]",
            theme === o.key && "text-[var(--accent)] font-semibold"
          )}
        >
          <Icon icon={o.icon} size="inline" />
          {o.label}
        </button>
      ))}
    </GlassMenu>
  );
}
