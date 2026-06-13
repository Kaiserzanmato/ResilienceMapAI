"use client";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  Bot,
  FileDown,
  Globe2,
  Layers,
  MapPin,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { GlassCard } from "@/components/ui/GlassCard";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

const FEATURES = [
  {
    icon: Globe2,
    title: "Immersive Risk Map",
    text: "Six map views — standard, satellite, terrain, hybrid, dark, light — with multi-hazard overlays, heatmaps, and animated zoom-to-location.",
  },
  {
    icon: Bot,
    title: "Grounded AI Assistant",
    text: "Persona-aware insights grounded in official datasets, with visible sources, confidence levels, and uncertainty. Never speculative predictions.",
  },
  {
    icon: BarChart3,
    title: "Executive Dashboards",
    text: "KPI cards, exposure analytics, hazard breakdowns, and location comparisons designed for decision-makers.",
  },
  {
    icon: Layers,
    title: "Multi-Hazard Intelligence",
    text: "Flood, earthquake, tropical cyclone, volcano, landslide, and storm surge — scored deterministically from trusted public data.",
  },
  {
    icon: FileDown,
    title: "Reports & Exports",
    text: "Persona-specific PDF briefs, structured CSV exports, executive summaries, and shareable report links in one click.",
  },
  {
    icon: ShieldCheck,
    title: "Trustworthy by Design",
    text: "Server-side AI, deterministic scoring, source provenance, audit logging, and rate limiting. The AI explains — it never decides risk.",
  },
];

const PERSONA_CHIPS = [
  "Citizens", "Travelers", "Homebuyers", "Real Estate", "Insurance", "Fintech",
  "NGOs", "Government", "Schools", "Businesses", "Emergency Response",
];

export default function LandingPage() {
  return (
    <div className="relative overflow-x-clip">
      {/* Minimal landing nav */}
      <header className="fixed inset-x-0 top-0 z-40 px-4 pt-3">
        <nav className="glass-strong mx-auto flex h-[var(--nav-h)] max-w-6xl items-center justify-between rounded-2xl px-4">
          <Link href="/" className="focus-ring flex items-center gap-2 rounded-lg">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-sm font-bold text-white"
            >
              R
            </span>
            <span className="text-[15px] font-semibold tracking-tight">
              ResilienceMap <span className="text-gradient">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/map"
              className="focus-ring flex h-10 items-center gap-1.5 rounded-xl bg-[var(--accent)] px-4 text-sm font-medium text-white hc:text-black shadow-[0_4px_20px_var(--accent-glow)] transition-all hover:brightness-110"
            >
              Launch App <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto flex min-h-[92dvh] max-w-6xl flex-col items-center justify-center px-4 pb-16 pt-32 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="glass mb-7 flex items-center gap-2 rounded-full px-4 py-2 text-xs font-medium text-[var(--fg-muted)]"
        >
          <Sparkles size={13} className="text-[var(--accent)]" aria-hidden="true" />
          AI-powered disaster risk intelligence — grounded in official data
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-4xl text-balance text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[1.05] tracking-tight"
        >
          Understand hazard risk,{" "}
          <span className="text-gradient">anywhere on Earth.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 max-w-2xl text-balance text-base leading-relaxed text-[var(--fg-muted)] sm:text-lg"
        >
          ResilienceMap AI turns official hazard data into immersive maps, executive
          dashboards, and grounded AI explanations — for families, governments,
          insurers, and everyone in between.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <Link
            href="/map"
            className="focus-ring flex h-13 items-center justify-center gap-2 rounded-2xl bg-[var(--accent)] px-7 py-3.5 text-[15px] font-semibold text-white hc:text-black shadow-[0_8px_32px_var(--accent-glow)] transition-all hover:scale-[1.03] hover:brightness-110"
          >
            <MapPin size={17} aria-hidden="true" /> Explore the Risk Map
          </Link>
          <Link
            href="/dashboard"
            className="focus-ring glass flex items-center justify-center gap-2 rounded-2xl px-7 py-3.5 text-[15px] font-semibold transition-all hover:scale-[1.03]"
          >
            <BarChart3 size={17} aria-hidden="true" /> View Dashboard
          </Link>
        </motion.div>

        {/* Hero visual: stylized risk gauge strip */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.36, ease: [0.22, 1, 0.36, 1] }}
          className="mt-16 w-full max-w-4xl"
        >
          <GlassCard strong className="grid grid-cols-2 gap-px overflow-hidden p-0 sm:grid-cols-4">
            {[
              { label: "Hazard layers", value: "7+", sub: "flood to storm surge" },
              { label: "Map views", value: "6", sub: "standard to satellite" },
              { label: "Personas", value: "7", sub: "citizen to government" },
              { label: "Risk engine", value: "100%", sub: "deterministic scoring" },
            ].map((s) => (
              <div key={s.label} className="px-6 py-6 text-center sm:py-8">
                <p className="text-3xl font-semibold tracking-tight text-gradient">{s.value}</p>
                <p className="mt-1 text-[13px] font-medium">{s.label}</p>
                <p className="text-[11px] text-[var(--fg-muted)]">{s.sub}</p>
              </div>
            ))}
          </GlassCard>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <motion.div {...fadeUp} className="mb-12 text-center">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
            A command center, <span className="text-gradient">not a dashboard.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[15px] text-[var(--fg-muted)]">
            Every surface is designed for clarity under pressure — immersive, source-grounded,
            and honest about uncertainty.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.06 }}>
              <GlassCard className="group h-full p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_48px_var(--accent-glow)]">
                <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] text-white shadow-[0_4px_16px_var(--accent-glow)]">
                  <f.icon size={20} aria-hidden="true" />
                </span>
                <h3 className="text-[15px] font-semibold">{f.title}</h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">{f.text}</p>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <motion.div {...fadeUp}>
          <GlassCard strong className="px-6 py-10 text-center sm:px-12">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Insights tailored to <span className="text-gradient">how you decide.</span>
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-[14.5px] text-[var(--fg-muted)]">
              Switch personas and the AI adapts — due diligence briefs for real estate,
              underwriting flags for insurers, preparedness plans for families.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-2">
              {PERSONA_CHIPS.map((p) => (
                <span
                  key={p}
                  className="glass rounded-full px-4 py-1.5 text-[13px] font-medium text-[var(--fg-muted)]"
                >
                  {p}
                </span>
              ))}
            </div>
            <Link
              href="/agents"
              className="focus-ring mt-9 inline-flex items-center gap-2 rounded-2xl bg-[var(--accent)] px-7 py-3.5 text-[15px] font-semibold text-white hc:text-black shadow-[0_8px_32px_var(--accent-glow)] transition-all hover:scale-[1.03]"
            >
              <Bot size={17} aria-hidden="true" /> Meet the AI Assistant
            </Link>
          </GlassCard>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--surface-border)] px-4 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center">
          <p className="text-sm font-semibold">
            ResilienceMap <span className="text-gradient">AI</span>
          </p>
          <p className="max-w-2xl text-xs leading-relaxed text-[var(--fg-muted)]">
            Indicative risk intelligence from official public datasets (USGS, NOAA, PAGASA,
            PHIVOLCS, Copernicus, World Bank). Not an official advisory and not a disaster
            prediction system — always follow guidance from local authorities.
          </p>
          <p className="text-[11px] text-[var(--fg-muted)]">
            © {new Date().getFullYear()} ResilienceMap AI
          </p>
        </div>
      </footer>
    </div>
  );
}
