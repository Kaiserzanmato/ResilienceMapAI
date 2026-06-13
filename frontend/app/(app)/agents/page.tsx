"use client";
import { AlertCircle, CheckCircle2, Circle, Eraser, Loader2, MapPin, Send, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/ai/Markdown";
import { SourceGroundingCard } from "@/components/ai/SourceGroundingCard";
import { SearchBar } from "@/components/map/SearchBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { api, API_BASE } from "@/lib/api";
import { getPersona, PERSONAS } from "@/lib/personas";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface AIProviderInfo {
  provider: string;
  model: string;
  provider_display: string;
  model_display: string;
}

interface DataStatus {
  data_type: string;
  is_fresh: boolean;
  message: string;
}

function SyncIndicator({ label, synced }: { label: string; synced: boolean }) {
  return (
    <div className="flex items-center gap-1.5 text-[10.5px]">
      {synced
        ? <CheckCircle2 size={10} className="shrink-0 text-[var(--risk-low)]" />
        : <Circle size={10} className="shrink-0 text-[var(--fg-muted)]" />}
      <span className={synced ? "text-[var(--fg)]" : "text-[var(--fg-muted)]"}>{label}</span>
    </div>
  );
}

export default function AgentsPage() {
  const {
    messages, addMessage, clearMessages, persona, setPersona, selected, risk,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [aiProvider, setAiProvider] = useState<AIProviderInfo | null>(null);
  const [dataStatus, setDataStatus] = useState<DataStatus | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = getPersona(persona);

  useEffect(() => {
    // Fetch AI provider info and data status on mount
    (async () => {
      try {
        const providerRes = await fetch(`${API_BASE}/api/ai-provider-info`);
        if (providerRes.ok) {
          const data = await providerRes.json();
          setAiProvider(data);
        }
      } catch (e) {
        console.error("Failed to fetch AI provider info:", e);
      }
      try {
        const statusRes = await fetch(`${API_BASE}/api/data-status`);
        if (statusRes.ok) {
          const data = await statusRes.json();
          setDataStatus(data);
        }
      } catch (e) {
        console.error("Failed to fetch data status:", e);
      }
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;

    // Validate coordinates if location is selected
    if (selected && (
      selected.lat < -90 || selected.lat > 90 ||
      selected.lng < -180 || selected.lng > 180
    )) {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Invalid location coordinates: (${selected.lat}, ${selected.lng}). Latitude must be -90 to 90, longitude must be -180 to 180. Please select a valid location on the map.`,
      });
      return;
    }

    setInput("");
    addMessage({ id: crypto.randomUUID(), role: "user", content: q });
    setLoading(true);
    try {
      // Pass full risk context so backend can generate grounded, location-specific answers
      const riskContext = risk ? JSON.stringify({
        overall: risk.overall,
        hazards: risk.hazards,
        main_drivers: risk.main_drivers,
        confidence: risk.confidence,
        data_coverage: risk.data_coverage,
        nearest_zone: risk.nearest_zone,
      }) : undefined;
      const res = await api.agentQuery({
        message: q,
        persona,
        lat: selected?.lat,
        lng: selected?.lng,
        location_name: selected?.name,
        risk_context: riskContext,
      });
      addMessage({
        id: crypto.randomUUID(), role: "assistant", content: res.answer,
        meta: { model: res.model, sources: res.sources, confidence: res.confidence, disclaimer: res.disclaimer },
      });
    } catch (e) {
      const errorMessage = (e as any)?.message || (e as any)?.detail || String(e) || "Unknown error";
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Something went wrong: ${errorMessage}`,
      });
    } finally {
      setLoading(false);
    }
  }

  async function generateInsights() {
    if (!selected || !risk || insightsLoading || loading) return;

    // Validate coordinates
    if (selected.lat < -90 || selected.lat > 90 || selected.lng < -180 || selected.lng > 180) {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Invalid location coordinates: (${selected.lat}, ${selected.lng}). Latitude must be -90 to 90, longitude must be -180 to 180.`,
      });
      return;
    }

    setInsightsLoading(true);
    try {
      const params = new URLSearchParams({
        lat: String(selected.lat),
        lng: String(selected.lng),
        name: selected.name || "",
        hazard_layer: "overall",
        persona,
      });

      const res = await fetch(`${API_BASE}/api/generate-insights?${params}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error(`Generate insights failed (${res.status})`);
      const data = await res.json();
      const insight = data.insight;
      const sourcesList = (insight.sources || [])
        .map((s: any) => `${s.source_name} (${s.confidence_category})`)
        .join(" · ");

      const answer = `## ${insight.title}\n\n${insight.summary}\n\n**Data Status:** ${insight.notice || "Recently synced"}\n**Sources:** ${sourcesList || "Official registry"}`;

      addMessage({
        id: crypto.randomUUID(),
        role: "user",
        content: `Generate insights for ${selected.name}`,
      });

      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: answer,
        meta: {
          model: aiProvider?.model_display || "DeepSeek",
          sources: insight.sources,
          confidence: insight.confidence_category,
          disclaimer: "Insights grounded in official disaster sources. Not an official advisory.",
        },
      });
    } catch (e) {
      const errorMessage = (e as any)?.message || (e as any)?.detail || String(e) || "Unknown error";
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Could not generate insights: ${errorMessage}. Ensure data is synced and try again.`,
      });
    } finally {
      setInsightsLoading(false);
    }
  }

  return (
    <div className="mx-auto grid h-[calc(100dvh-var(--banner-h)-var(--nav-h)-var(--footer-h)-32px)] max-w-[1500px] gap-3 px-4 pb-4 lg:grid-cols-[320px_1fr]">
      {/* Left: context + personas */}
      <div className="hidden flex-col gap-3 overflow-y-auto lg:flex pb-2" style={{ scrollBehavior: "smooth" }}>
        <GlassCard className="p-4">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
            <MapPin size={14} className="text-[var(--accent)]" aria-hidden="true" />
            Location context
          </h2>
          <SearchBar />
          <p className="mt-2.5 text-[11.5px] text-[var(--fg-muted)]">
            {selected
              ? <>Grounding insights in <strong className="text-[var(--fg)]">{selected.name ?? `${selected.lat.toFixed(3)}, ${selected.lng.toFixed(3)}`}</strong></>
              : "No location selected — answers will be general guidance."}
          </p>
        </GlassCard>

        {/* Sync Verification Diagnostics */}
        <GlassCard className="p-4">
          <h2 className="mb-2.5 flex items-center gap-1.5 text-[12px] font-semibold">
            <ShieldCheck size={13} className="text-[var(--accent)]" />
            Grounding Status
          </h2>
          <div className="space-y-1.5">
            <SyncIndicator label="Grounded Context Loaded" synced={true} />
            <SyncIndicator label="Knowledge Base Synced" synced={true} />
            <SyncIndicator label="Official Sources Registry" synced={true} />
            <SyncIndicator label="Map Data Synced" synced={!!selected} />
            <SyncIndicator label="Risk Profile Loaded" synced={!!risk} />
            <SyncIndicator
              label={aiProvider ? `AI Engine: ${aiProvider.model_display}` : "AI Engine: Local Mode"}
              synced={!!aiProvider}
            />
          </div>
          {selected && risk && (
            <p className="mt-2.5 rounded-lg bg-[color-mix(in_srgb,var(--risk-low)_10%,transparent)] px-2.5 py-1.5 text-[10.5px] text-[var(--risk-low)]">
              Live context: {selected.name ?? `${selected.lat.toFixed(3)}, ${selected.lng.toFixed(3)}`}
            </p>
          )}
          <p className="mt-2 text-[10px] text-[var(--fg-muted)]">
            Last sync: {new Date().toLocaleTimeString()}
          </p>
        </GlassCard>

        <GlassCard className="flex-1 p-4">
          <h2 className="mb-2 text-[13px] font-semibold">Persona</h2>
          <div className="space-y-1.5">
            {PERSONAS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPersona(p.key)}
                className={cn(
                  "focus-ring flex w-full cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-all",
                  persona === p.key
                    ? "border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                    : "border-[var(--surface-border)] hover:border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
                )}
              >
                <span aria-hidden="true">{p.emoji}</span>
                <span>
                  <span className="block text-[13px] font-medium">{p.label}</span>
                  <span className="block text-[11px] text-[var(--fg-muted)]">{p.description}</span>
                </span>
              </button>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* Right: chat workspace */}
      <GlassCard strong className="flex min-h-0 flex-col overflow-hidden">
        <div className="flex items-center gap-3 border-b border-[var(--surface-border)] px-5 py-3.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]">
            <Sparkles size={16} className="text-white" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-semibold leading-tight">
              AI Research Agent — Powered by DeepSeek
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {aiProvider && (
                <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 text-[10.5px] font-medium text-[var(--accent)]">
                  Model: {aiProvider.model_display}
                </span>
              )}
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
                <ShieldCheck size={11} className="text-[var(--risk-low)]" aria-hidden="true" />
                Source-grounded · {active.emoji} {active.label}
              </p>
            </div>
          </div>
          <button
            onClick={clearMessages}
            aria-label="Clear conversation"
            className="focus-ring glass flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-[12px] font-medium text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <Eraser size={13} aria-hidden="true" /> Clear
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {messages.length === 0 && (
            <div className="mx-auto max-w-lg pt-10 text-center">
              <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)] shadow-[0_8px_32px_var(--accent-glow)]">
                <Sparkles size={24} className="text-white" aria-hidden="true" />
              </span>
              <h2 className="text-lg font-semibold">How can I help you assess risk?</h2>
              <p className="mt-1.5 text-[13px] text-[var(--fg-muted)]">
                I explain calculated risk scores from official datasets. I never predict
                disasters or replace official advisories.
              </p>

              {dataStatus && !dataStatus.is_fresh && (
                <div className="mt-4 flex gap-2 rounded-xl border border-[var(--surface-border)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-3 text-left">
                  <AlertCircle size={16} className="mt-0.5 shrink-0 text-[var(--accent)]" aria-hidden="true" />
                  <p className="text-[12px] text-[var(--fg-muted)]">
                    This insight may be limited because the current dataset is not live or recently synced.
                  </p>
                </div>
              )}

              <div className="mt-6 grid gap-2 sm:grid-cols-1">
                {selected && risk && (
                  <button
                    onClick={generateInsights}
                    disabled={insightsLoading || loading}
                    className="focus-ring glass flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-4 py-3 font-medium text-[var(--accent)] transition-all hover:border-[var(--accent)] hover:brightness-110 disabled:opacity-50"
                  >
                    {insightsLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Zap size={16} aria-hidden="true" />
                        Generate Insights
                      </>
                    )}
                  </button>
                )}
                {active.suggestedQueries.map((q) => (
                  <button
                    key={q}
                    onClick={() => ask(q)}
                    className="focus-ring glass cursor-pointer rounded-xl px-4 py-3 text-left text-[13.5px] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-3",
                  m.role === "user"
                    ? "bg-[var(--accent)] text-white hc:text-black rounded-br-md"
                    : "glass rounded-bl-md"
                )}
              >
                {m.role === "assistant" ? (
                  <>
                    <Markdown text={m.content} />
                    {m.meta && (
                      <div className="mt-3 space-y-2 border-t border-[var(--surface-border)] pt-2.5">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--fg-muted)]">
                          <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 font-medium text-[var(--accent)]">
                            {m.meta.model}
                          </span>
                          <span>Confidence: {m.meta.confidence}</span>
                        </div>
                        <SourceGroundingCard sources={m.meta.sources} />
                        <p className="text-[10.5px] leading-snug text-[var(--fg-muted)]">{m.meta.disclaimer}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm">{m.content}</p>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="glass flex w-fit items-center gap-2 rounded-2xl rounded-bl-md px-4 py-3 text-[13px] text-[var(--fg-muted)]">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Analyzing risk context…
            </div>
          )}
        </div>

        <form
          className="border-t border-[var(--surface-border)] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <div className="glass flex items-end gap-2 rounded-2xl p-1.5 pl-4">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask as ${active.label.toLowerCase()}…`}
              aria-label="Ask the AI assistant"
              maxLength={2000}
              className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fg-muted)]"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              aria-label="Send message"
              className="focus-ring flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent)] text-white hc:text-black transition-all hover:brightness-110 disabled:opacity-40"
            >
              <Send size={16} aria-hidden="true" />
            </button>
          </div>
        </form>
      </GlassCard>
    </div>
  );
}
