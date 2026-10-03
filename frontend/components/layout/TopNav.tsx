"use client";
import {
  CloudSun,
  Database,
  FileText,
  LayoutDashboard,
  Map as MapIcon,
  Menu,
  MoreHorizontal,
  Settings,
  Sparkles,
  X,
  BookOpen,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { usePriorityNav } from "@/lib/usePriorityNav";
import { Logo } from "@/components/brand/Logo";
import { GlassMenu } from "@/components/ui/GlassMenu";
import { Icon } from "@/components/ui/Icon";
import { Tooltip } from "@/components/ui/Tooltip";
import { PersonaSelector } from "./PersonaSelector";
import { ThemeToggle } from "./ThemeToggle";

const MORE_BUTTON_CLASS =
  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-medium transition-all";

// Priority order, most important first: when space runs out, items fall off
// the end into the "More" menu before anything earlier in this list does.
const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: MapIcon },
  { href: "/agents", label: "AI Workspace", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/weather", label: "Weather Map Forecast", icon: CloudSun },
  { href: "/admin/datasets", label: "Datasets", icon: Database },
  { href: "/resources", label: "Resources", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

/** Icon-only below the --breakpoint-nav-labels token (1440px), icon+label at
 * and above it. The label is always in the DOM (for the accessible name and
 * for the hidden measurement row to size correctly at either breakpoint) —
 * `nav-labels:inline` only toggles its visibility. */
function NavLink({
  link,
  active,
}: {
  link: (typeof LINKS)[number];
  active: boolean;
}) {
  return (
    <Tooltip label={link.label}>
      <Link
        href={link.href}
        aria-current={active ? "page" : undefined}
        aria-label={link.label}
        className={cn(
          "focus-ring flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-[13px] font-medium transition-all",
          active
            ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]"
            : "text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-[var(--fg)]"
        )}
      >
        <Icon icon={link.icon} size="inline" />
        <span className="hidden nav-labels:inline">{link.label}</span>
      </Link>
    </Tooltip>
  );
}

export function TopNav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { containerRef, measureRef, moreRef, visibleCount } = usePriorityNav(LINKS.length);
  const visible = LINKS.slice(0, visibleCount);
  const overflowed = LINKS.slice(visibleCount);
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <header data-map-obstruction="top" className="fixed inset-x-0 top-[var(--banner-h)] z-[var(--z-top-bar)] px-3 pt-3 sm:px-4">
      <nav
        aria-label="Primary"
        className="glass-strong mx-auto flex h-[var(--nav-h)] max-w-[1800px] items-center gap-2 rounded-2xl px-3 sm:px-4"
      >
        <Link
          href="/"
          className="focus-ring mr-1 flex shrink-0 items-center gap-2 rounded-lg px-1"
        >
          <Logo className="h-8 w-8" />
          <span className="hidden text-[15px] font-semibold tracking-tight md:block">
            ResilienceMap <span className="text-gradient">AI</span>
          </span>
        </Link>

        {/* Priority nav: as many links as fit, in LINKS' priority order, the
            rest in "More". Hidden below md — the dedicated mobile panel below
            covers that range instead, where there's no room for even one
            icon-only item alongside the logo and trailing controls. */}
        <div
          ref={containerRef}
          className="relative hidden min-w-0 flex-1 items-center gap-1 overflow-hidden md:flex"
        >
          {/* Measurement-only: real widths at the current breakpoint, out of flow and invisible.
              Includes a copy of the "More" trigger so its width is known *before* the live one
              conditionally renders — the hook needs that width to decide whether to render it. */}
          <div
            ref={measureRef}
            aria-hidden="true"
            className="pointer-events-none invisible absolute left-0 top-0 flex items-center gap-1"
          >
            {LINKS.map((l) => (
              <NavLink key={l.href} link={l} active={pathname.startsWith(l.href)} />
            ))}
            <div ref={moreRef} className={MORE_BUTTON_CLASS}>
              <MoreHorizontal size={15} aria-hidden="true" />
              <span className="hidden nav-labels:inline">More</span>
            </div>
          </div>

          {visible.map((l) => (
            <NavLink key={l.href} link={l} active={pathname.startsWith(l.href)} />
          ))}

          {overflowed.length > 0 && (
            <GlassMenu
              open={moreOpen}
              onOpenChange={setMoreOpen}
              label="More navigation links"
              align="left"
              className="w-56"
              trigger={
                <button
                  aria-label="More navigation links"
                  aria-expanded={moreOpen}
                  onClick={() => setMoreOpen((v) => !v)}
                  className={cn(
                    MORE_BUTTON_CLASS,
                    "focus-ring cursor-pointer",
                    overflowed.some((l) => pathname.startsWith(l.href))
                      ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-[var(--accent)]"
                      : "text-[var(--fg-muted)] hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-[var(--fg)]"
                  )}
                >
                  <MoreHorizontal size={15} aria-hidden="true" />
                  <span className="hidden nav-labels:inline">More</span>
                </button>
              }
            >
              {overflowed.map((l) => {
                const active = pathname.startsWith(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "focus-ring flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]",
                      active && "text-[var(--accent)]"
                    )}
                  >
                    <Icon icon={l.icon} size="inline" />
                    {l.label}
                  </Link>
                );
              })}
            </GlassMenu>
          )}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <PersonaSelector />
          <ThemeToggle />
          <button
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
            className="focus-ring glass flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl md:hidden"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="glass-strong mx-auto mt-2 max-w-[1800px] rounded-2xl p-2 md:hidden">
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
