"use client";
import {
  BookOpen,
  Video,
  BarChart3,
  AlertTriangle,
  Cloud,
  Map,
  Zap,
  Globe,
  ArrowRight,
} from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export default function ResourcesPage() {
  const documentationCards = [
    {
      icon: BookOpen,
      title: "Getting Started",
      description: "Learn the basics of ResilienceMap AI and get up and running in minutes.",
    },
    {
      icon: BarChart3,
      title: "Risk Scoring Methodology",
      description: "Understand how we calculate deterministic risk scores and hazard metrics.",
    },
    {
      icon: Zap,
      title: "API Reference",
      description: "Integrate ResilienceMap data into your own systems and applications.",
    },
    {
      icon: Map,
      title: "Data Sources",
      description: "Explore the authoritative sources powering our risk intelligence.",
    },
  ];

  const datasetCards = [
    {
      icon: Globe,
      title: "World Risk Index",
      subtitle: "WRI",
      description: "Global rankings of disaster-risk countries compiled by Ruhr University Bochum.",
    },
    {
      icon: AlertTriangle,
      title: "INFORM Risk Index",
      subtitle: "Humanitarian Risk",
      description: "Vulnerability metrics for humanitarian crises and disaster response.",
    },
    {
      icon: Cloud,
      title: "ND-GAIN Index",
      subtitle: "Climate Resilience",
      description: "Climate vulnerability and adaptive capacity scores from Notre Dame.",
    },
    {
      icon: BarChart3,
      title: "Hazard Rankings",
      subtitle: "Specific Risks",
      description: "Earthquake, tsunami, volcanic, cyclone, flood, drought, and wildfire assessments.",
    },
    {
      icon: AlertTriangle,
      title: "Political & Conflict Risk",
      subtitle: "Fragility Index",
      description: "Global Peace Index, Fragile States Index, and active armed conflict data.",
    },
    {
      icon: Map,
      title: "Climate & Environmental",
      subtitle: "Long-term Risks",
      description: "Sea level rise, drought scarcity, and environmental degradation trends.",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-20 px-4 md:px-6 lg:px-8">
      {/* Page Header */}
      <div className="space-y-3">
        <h1 className="text-5xl font-bold tracking-tight">Resources</h1>
        <p className="max-w-2xl text-lg text-[var(--fg-muted)]">
          Educational materials, research foundations, and knowledge hub for global risk assessment
        </p>
      </div>

      {/* Featured Video - Hero Section */}
      <div className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--surface)] to-[var(--surface-secondary)] p-1">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <div className="aspect-video w-full overflow-hidden">
              <video
                controls
                className="h-full w-full"
                poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Crect fill='%23111827' width='1280' height='720'/%3E%3C/svg%3E"
              >
                <source src="/resilience-equation.mp4" type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-bold">The Resilience Equation: Mapping Global Risk</h2>
          <p className="max-w-3xl text-base text-[var(--fg-muted)] leading-relaxed">
            A comprehensive overview of how ResilienceMap AI integrates disaster risk assessment,
            climate vulnerability, and resilience metrics to provide actionable intelligence for
            informed decision-making in global risk management and strategic planning.
          </p>
        </div>
      </div>

      {/* Documentation Section */}
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Documentation</h2>
          <p className="text-[var(--fg-muted)]">
            Everything you need to understand and use ResilienceMap AI
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {documentationCards.map((card) => {
            const Icon = card.icon;
            return (
              <GlassCard
                key={card.title}
                className="group flex flex-col gap-4 p-6 transition-all hover:bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]"
              >
                <div className="rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3 w-fit">
                  <Icon size={24} className="text-[var(--accent)]" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="font-semibold leading-tight">{card.title}</h3>
                  <p className="text-sm text-[var(--fg-muted)] leading-relaxed">
                    {card.description}
                  </p>
                </div>
                <button className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] opacity-0 transition-opacity group-hover:opacity-100">
                  Learn more <ArrowRight size={14} />
                </button>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Research Dataset Section */}
      <div className="space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold">Research Dataset</h2>
          <p className="text-[var(--fg-muted)]">
            Authoritative sources and indices powering ResilienceMap AI intelligence
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {datasetCards.map((dataset) => {
            const Icon = dataset.icon;
            return (
              <GlassCard
                key={dataset.title}
                className="flex flex-col gap-4 p-6 border border-[var(--surface-border)]"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="rounded-lg bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] p-3">
                      <Icon size={20} className="text-[var(--accent)]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">
                      {dataset.subtitle}
                    </span>
                  </div>

                  <div>
                    <h3 className="font-semibold leading-tight">{dataset.title}</h3>
                    <p className="mt-2 text-sm text-[var(--fg-muted)] leading-relaxed">
                      {dataset.description}
                    </p>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      </div>

      {/* Quick Links Section */}
      <div className="space-y-6 rounded-2xl border border-[var(--surface-border)] bg-gradient-to-br from-[color-mix(in_srgb,var(--accent)_4%,transparent)] to-[color-mix(in_srgb,var(--accent-2)_4%,transparent)] p-8">
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Need More Information?</h3>
          <p className="text-sm text-[var(--fg-muted)]">
            Connect with our team or explore additional resources
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[color-mix(in_srgb,var(--accent)_85%,#000)]">
            Contact Us <ArrowRight size={16} />
          </button>
          <button className="flex items-center justify-center gap-2 rounded-lg border border-[var(--surface-border)] px-6 py-2.5 text-sm font-semibold text-[var(--fg)] transition-all hover:bg-[color-mix(in_srgb,var(--fg)_5%,transparent)]">
            View Full Dataset <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Footer Note */}
      <div className="rounded-lg border border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--surface)_50%,transparent)] p-6">
        <p className="text-xs text-[var(--fg-muted)] leading-relaxed">
          <strong>Data Accuracy Notice:</strong> All datasets in ResilienceMap AI are sourced
          from verified government agencies, scientific institutions, and internationally
          recognized indices. No independent risk scores are generated. For real-time risk
          assessment, always reference the ResilienceMap risk engine outputs and official
          government advisories.
        </p>
      </div>
    </div>
  );
}
