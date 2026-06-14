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
            {/* Summary */}
            {insight.summary && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Intelligence Summary</h3>
                <p className="text-[var(--fg-muted)] leading-relaxed whitespace-pre-wrap">
                  {insight.summary.split("\n\n")[0]}
                </p>
              </section>
            )}

            {/* Notice */}
            {insight.notice && (
              <section className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg text-sm text-[var(--fg-muted)]">
                {insight.notice}
              </section>
            )}

            {/* Hazard Types */}
            {insight.hazard_type && (
              <section>
                <h3 className="text-lg font-semibold mb-2">Hazard Assessment</h3>
                <p className="text-[var(--fg-muted)] text-sm">
                  <span className="font-semibold">Type:</span> {insight.hazard_type}
                </p>
              </section>
            )}

            {/* Sources */}
            {insight.sources && insight.sources.length > 0 && (
              <section>
                <h3 className="text-lg font-semibold mb-3">Official Sources</h3>
                <div className="space-y-2">
                  {insight.sources.map((source: any, idx: number) => (
                    <a
                      key={idx}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-2 rounded-lg bg-[color-mix(in_srgb,var(--fg)_5%,transparent)] hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] transition-colors"
                    >
                      <div className="font-medium text-sm">{source.source_name}</div>
                      <div className="text-xs text-[var(--fg-muted)]">{source.agency}</div>
                      {source.verified && (
                        <div className="text-xs text-green-500 mt-1">✓ Official Source</div>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Metadata */}
            <div className="pt-4 border-t border-[var(--fg)]/10 space-y-2 text-xs text-[var(--fg-muted)]">
              {insight.confidence_category && (
                <div>
                  <span className="font-semibold">Confidence:</span> {insight.confidence_category.replace(/_/g, " ")}
                </div>
              )}
              {insight.timestamp && (
                <div>
                  <span className="font-semibold">Generated:</span> {new Date(insight.timestamp).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}
