"use client";
import { motion } from "framer-motion";
import { AlertCircle, Loader2, X } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";

interface InsightsPanelProps {
  isOpen: boolean;
  isLoading: boolean;
  error?: string | null;
  insight?: any;
  locationName?: string;
  onClose: () => void;
}

export function InsightsPanel({
  isOpen,
  isLoading,
  error,
  insight,
  locationName,
  onClose,
}: InsightsPanelProps) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <GlassCard strong className="relative max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold">Risk Intelligence Insights</h2>
            {locationName && (
              <p className="text-sm text-[var(--fg-muted)] mt-1">{locationName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[color-mix(in_srgb,var(--fg)_10%,transparent)] rounded-lg transition-colors"
            aria-label="Close insights panel"
          >
            <X size={20} />
          </button>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 size={32} className="animate-spin text-[var(--accent)]" />
            <p className="text-[var(--fg-muted)]">Generating intelligence insights...</p>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex gap-3">
            <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-500">Failed to generate insights</p>
              <p className="text-sm text-[var(--fg-muted)] mt-1">{error}</p>
              <button
                onClick={onClose}
                className="mt-3 text-sm text-red-500 hover:text-red-600 font-medium"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {insight && !isLoading && !error && (
          <div className="space-y-6">
            {/* Executive Summary */}
            {insight.summary && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Executive Summary</h3>
                <p className="text-[var(--fg-muted)] leading-relaxed">{insight.summary}</p>
              </section>
            )}

            {/* Risk Drivers */}
            {insight.risk_drivers && insight.risk_drivers.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Primary Risk Drivers</h3>
                <ul className="space-y-2">
                  {insight.risk_drivers.map((driver: string, idx: number) => (
                    <li key={idx} className="flex gap-2 text-sm">
                      <span className="text-[var(--accent)] font-bold">•</span>
                      <span>{driver}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Historical Context */}
            {insight.historical_context && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Historical Context</h3>
                <p className="text-[var(--fg-muted)] leading-relaxed">{insight.historical_context}</p>
              </section>
            )}

            {/* Exposure Analysis */}
            {insight.exposure && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Population & Infrastructure Exposure</h3>
                <p className="text-[var(--fg-muted)] leading-relaxed">{insight.exposure}</p>
              </section>
            )}

            {/* Preparedness */}
            {insight.preparedness && insight.preparedness.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Preparedness Considerations</h3>
                <ul className="space-y-2">
                  {insight.preparedness.map((item: string, idx: number) => (
                    <li key={idx} className="flex gap-2 text-sm">
                      <span className="text-[var(--accent)] font-bold">→</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Metadata */}
            <div className="pt-4 border-t border-[var(--fg)]/10 space-y-2 text-xs text-[var(--fg-muted)]">
              {insight.confidence && (
                <div>
                  <span className="font-semibold">Confidence:</span> {insight.confidence}
                </div>
              )}
              {insight.sources && insight.sources.length > 0 && (
                <div>
                  <span className="font-semibold">Sources:</span> {insight.sources.join(", ")}
                </div>
              )}
              {insight.last_updated && (
                <div>
                  <span className="font-semibold">Last Updated:</span> {new Date(insight.last_updated).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
