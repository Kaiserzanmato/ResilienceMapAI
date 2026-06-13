"use client";
import { Eraser, Loader2, MapPin, Send, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Markdown } from "@/components/ai/Markdown";
import { SourceGroundingCard } from "@/components/ai/SourceGroundingCard";
import { SearchBar } from "@/components/map/SearchBar";
import { GlassCard } from "@/components/ui/GlassCard";
import { api } from "@/lib/api";
import { getPersona, PERSONAS } from "@/lib/personas";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function AgentsPage() {
  const {
    messages, addMessage, clearMessages, persona, setPersona, selected,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const active = getPersona(persona);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || loading) return;
    setInput("");
    addMessage({ id: crypto.randomUUID(), role: "user", content: q });
    setLoading(true);
    try {
      const res = await api.agentQuery({
        message: q, persona,
        lat: selected?.lat, lng: selected?.lng, location_name: selected?.name,
      });
      addMessage({
        id: crypto.randomUUID(), role: "assistant", content: res.answer,
        meta: { model: res.model, sources: res.sources, confidence: res.confidence, disclaimer: res.disclaimer },
      });
    } catch (e) {
      addMessage({
        id: crypto.randomUUID(), role: "assistant",
        content: `Something went wrong: ${(e as Error).message}`,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto grid h-[calc(100dvh-var(--nav-h)-32px)] max-w-[1500px] gap-3 px-4 pb-4 lg:grid-cols-[320px_1fr]">
      {/* Left: context + personas */}
      <div className="hidden flex-col gap-3 overflow-y-auto lg:flex">
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
            <h1 className="text-[15px] font-semibold leading-tight">AI Research Agent</h1>
            <p className="flex items-center gap-1.5 text-[11px] text-[var(--fg-muted)]">
              <ShieldCheck size={11} className="text-[var(--risk-low)]" aria-hidden="true" />
              Source-grounded · {active.emoji} {active.label} persona
            </p>
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
              <div className="mt-6 grid gap-2 sm:grid-cols-1">
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
