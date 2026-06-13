"use client";
import {
  Database,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PersonaSelector } from "./PersonaSelector";
import { ThemeToggle } from "./ThemeToggle";

const LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/agents", label: "AI Workspace", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/admin/datasets", label: "Datasets", icon: Database },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 pt-3 sm:px-4">
      <nav
        aria-label="Primary"
        className="glass-strong mx-auto flex h-[var(--nav-h)] max-w-[1800px] items-center gap-2 rounded-2xl px-3 sm:px-4"
      >
        <Link
          href="/"
          className="focus-ring mr-1 flex shrink-0 items-center gap-2 rounded-lg px-1"
        >
          <span
            aria-hidden="true"
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-sm font-bold text-white shadow-[0_4px_16px_var(--accent-glow)]"
          >
            R
          </span>
          <span className="hidden text-[15px] font-semibold tracking-tight md:block">
            ResilienceMap <span className="text-gradient">AI</span>
          </span>
        </Link>

        <div className="hidden flex-1 items-center gap-1 lg:flex">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
                  active
                    ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]"
                    : "text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-[var(--fg)]"
                )}
              >
                <l.icon size={15} aria-hidden="true" />
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <PersonaSelector />
          <ThemeToggle />
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="focus-ring glass flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl lg:hidden"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="glass-strong mx-auto mt-2 max-w-[1800px] rounded-2xl p-2 lg:hidden">
          {LINKS.map((l) => {
            const active = pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "focus-ring flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium",
                  active
                    ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]"
                    : "text-[var(--fg-muted)]"
                )}
              >
                <l.icon size={17} aria-hidden="true" />
                {l.label}
              </Link>
            );
          })}
        </div>
      )}
    </header>
  );
}
