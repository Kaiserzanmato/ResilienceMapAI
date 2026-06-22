"use client";
import { BookOpen, Video } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

export default function ResourcesPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Resources</h1>
        <p className="mt-2 text-[var(--fg-muted)]">
          Educational materials and research content on global risk assessment
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Videos Section */}
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-3">
            <Video size={24} className="text-[var(--accent)]" />
            <h2 className="text-xl font-semibold">Featured Video</h2>
          </div>
          <div className="aspect-video overflow-hidden rounded-lg bg-black">
            <video
              controls
              className="h-full w-full"
              poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1280 720'%3E%3Crect fill='%23111827' width='1280' height='720'/%3E%3Ccircle cx='640' cy='360' r='60' fill='%234F46E5' opacity='0.3'/%3E%3C/svg%3E"
            >
              <source src="/resilience-equation.mp4" type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          </div>
          <div>
            <h3 className="font-semibold">The Resilience Equation: Mapping Global Risk</h3>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              A comprehensive overview of how ResilienceMap AI integrates disaster risk,
              climate vulnerability, and resilience metrics to provide actionable intelligence
              for global risk assessment.
            </p>
          </div>
        </GlassCard>

        {/* Documentation Section */}
        <GlassCard className="space-y-4">
          <div className="flex items-center gap-3">
            <BookOpen size={24} className="text-[var(--accent)]" />
            <h2 className="text-xl font-semibold">Documentation</h2>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-[var(--fg-muted)]">
              Learn how to use ResilienceMap AI to assess risk, monitor hazards, and plan
              resilience strategies.
            </p>
            <div className="space-y-2">
              <a
                href="#"
                className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                → Getting Started Guide
              </a>
              <a
                href="#"
                className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                → Risk Scoring Methodology
              </a>
              <a
                href="#"
                className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                → API Reference
              </a>
              <a
                href="#"
                className="flex items-center gap-2 text-sm font-medium text-[var(--accent)] hover:underline"
              >
                → Data Sources
              </a>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Research Dataset Section */}
      <GlassCard>
        <h2 className="mb-3 text-xl font-semibold">Research Dataset</h2>
        <p className="mb-4 text-sm text-[var(--fg-muted)]">
          The research dataset powering ResilienceMap AI includes:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--accent)]">•</span>
            <span>
              <strong>World Risk Index (WRI):</strong> Global rankings of disaster-risk countries
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--accent)]">•</span>
            <span>
              <strong>INFORM Risk Index:</strong> Humanitarian crisis vulnerability metrics
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--accent)]">•</span>
            <span>
              <strong>ND-GAIN Index:</strong> Climate resilience and adaptive capacity scores
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--accent)]">•</span>
            <span>
              <strong>Hazard-Specific Rankings:</strong> Earthquake, tsunami, volcanic, cyclone,
              drought, flood, sea level rise, and wildfire risk assessments
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-1 text-[var(--accent)]">•</span>
            <span>
              <strong>Political & Conflict Risk:</strong> Global Peace Index, Fragile States Index,
              active armed conflicts
            </span>
          </li>
        </ul>
      </GlassCard>
    </div>
  );
}
