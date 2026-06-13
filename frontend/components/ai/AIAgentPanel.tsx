"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Eraser,
  Loader2,
  Pin,
  PinOff,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { getPersona } from "@/lib/personas";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Markdown } from "./Markdown";
import { SourceGroundingCard } from "./SourceGroundingCard";

export function AIAgentPanel() {
  const {
    aiOpen, setAiOpen, aiPinned, setAiPinned, messages, addMessage,
    clearMessages, persona, selected, risk,
  } = useAppStore();
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [panelWidth, setPanelWidth] = useState(400);
  const scrollRef = useRef<HTMLDivElement>(null);
  const activePersona = getPersona(persona);

  // Desktop resize: drag the left edge (spec §15 — resize on desktop)
  function startResize(e: React.PointerEvent) {
    e.preventDefault();
    const onMove = (ev: PointerEvent) => {
      const w = window.innerWidth - ev.clientX - 12;
      setPanelWidth(Math.min(640, Math.max(340, w)));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

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
        message: q,
        persona,
        lat: selected?.lat,
        lng: selected?.lng,
        location_name: selected?.name,
      });
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: res.answer,
        meta: {
          model: res.model,
          sources: res.sources,
          confidence: res.confidence,
          disclaimer: res.disclaimer,
        },
      });
    } catch (e) {
      addMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: `Something went wrong reaching the AI service: ${(e as Error).message}. Please try again.`,
      });
    } finally {
      setLoading(false);
    }
  }

  const contextLabel = selected?.name ?? risk?.location_name ?? "No location selected";

  return (
    <>
      {/* Collapsed: vertical tab (desktop) / floating button (mobile) */}
      <AnimatePresence>
        {!aiOpen && (
          <motion.button
            key="ai-tab"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            onClick={() => setAiOpen(true)}
            aria-label="Open AI assistant"
            className={cn(
              "focus-ring fixed z-40 cursor-pointer",
              // mobile: floating round button; desktop: right-edge vertical tab
              "bottom-5 right-4 flex h-14 w-14 items-center justify-center rounded-full",
              "md:bottom-auto md:right-0 md:top-1/2 md:h-auto md:w-auto md:-translate-y-1/2 md:rounded-l-2xl md:rounded-r-none md:px-2.5 md:py-5",
              "glass-strong glow-ring transition-transform hover:scale-105"
            )}
          >
            <span className="flex items-center gap-2 md:flex-col">
              <Sparkles size={20} className="text-[var(--accent)]" aria-hidden="true" />
              <span className="hidden text-[11px] font-semibold tracking-widest md:block md:[writing-mode:vertical-rl]">
                AI AGENT
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Expanded panel */}
      <AnimatePresence>
        {aiOpen && (
          <motion.aside
            key="ai-panel"
            role="complementary"
            aria-label="AI assistant"
            initial={{ opacity: 0, x: 80 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 80 }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
            style={{ "--ai-w": `${panelWidth}px` } as React.CSSProperties}
            className={cn(
              "glass-strong fixed z-40 flex flex-col overflow-hidden",
              // mobile: bottom sheet; desktop: right panel (resizable)
              "inset-x-0 bottom-0 top-auto h-[72dvh] rounded-t-3xl",
              "md:inset-x-auto md:bottom-3 md:right-3 md:top-[calc(var(--nav-h)+22px)] md:h-auto md:w-[var(--ai-w)] md:rounded-2xl"
            )}
          >
            {/* Resize handle (desktop only) */}
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize AI panel"
              onPointerDown={startResize}
              className="absolute left-0 top-0 z-10 hidden h-full w-1.5 cursor-ew-resize transition-colors hover:bg-[var(--accent)] md:block"
            />
            {/* Header */}
            <div className="border-b border-[var(--surface-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-2)]">
                  <Sparkles size={15} className="text-white" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-tight">AI Research Agent</p>
                  <p className="truncate text-[11px] text-[var(--fg-muted)]">
                    {activePersona.emoji} {activePersona.label} · {contextLabel}
                  </p>
                </div>
                <button
                  aria-label={aiPinned ? "Unpin panel" : "Pin panel open"}
                  onClick={() => setAiPinned(!aiPinned)}
                  className="focus-ring cursor-pointer rounded-lg p-2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  {aiPinned ? <PinOff size={15} /> : <Pin size={15} />}
                </button>
                <button
                  aria-label="Clear conversation"
                  onClick={clearMessages}
                  className="focus-ring cursor-pointer rounded-lg p-2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  <Eraser size={15} />
                </button>
                <button
                  aria-label="Close AI assistant"
                  onClick={() => setAiOpen(false)}
                  className="focus-ring cursor-pointer rounded-lg p-2 text-[var(--fg-muted)] hover:text-[var(--fg)]"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="mt-2 flex items-center gap-1.5 text-[10.5px] text-[var(--fg-muted)]">
                <ShieldCheck size={12} className="text-[var(--risk-low)]" aria-hidden="true" />
                Source-grounded · scores computed by the risk engine, never by AI
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.length === 0 && (
                <div className="space-y-3 pt-2">
                  <p className="text-sm text-[var(--fg-muted)]">
                    Ask about hazard exposure, preparedness, or comparisons.
                    {selected ? (
                      <> Context: <strong className="text-[var(--fg)]">{contextLabel}</strong>.</>
                    ) : (
                      <> Select a location on the map for grounded insights.</>
                    )}
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-muted)]">
                      Suggested for {activePersona.label}
                    </p>
                    {activePersona.suggestedQueries.map((q) => (
                      <button
                        key={q}
                        onClick={() => ask(q)}
                        className="focus-ring glass block w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-[13px] transition-all hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div
                  key={m.id}
                  className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[88%] rounded-2xl px-3.5 py-2.5",
                      m.role === "user"
                        ? "bg-[var(--accent)] text-white hc:text-black rounded-br-md"
                        : "glass rounded-bl-md"
                    )}
                  >
                    {m.role === "assistant" ? (
                      <>
                        <Markdown text={m.content} />
                        {m.meta && (
                          <div className="mt-2.5 space-y-2 border-t border-[var(--surface-border)] pt-2">
                            <div className="flex flex-wrap items-center gap-2 text-[10.5px] text-[var(--fg-muted)]">
                              <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] px-2 py-0.5 font-medium text-[var(--accent)]">
                                {m.meta.model}
                              </span>
                              <span>Confidence: {m.meta.confidence}</span>
                            </div>
                            <SourceGroundingCard sources={m.meta.sources} />
                            <p className="text-[10px] leading-snug text-[var(--fg-muted)]">
                              {m.meta.disclaimer}
                            </p>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-[13.5px]">{m.content}</p>
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

            {/* Input */}
            <form
              className="border-t border-[var(--surface-border)] p-3"
              onSubmit={(e) => {
                e.preventDefault();
                ask(input);
              }}
            >
              <div className="glass flex items-end gap-2 rounded-2xl p-1.5 pl-4">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about risk, exposure, preparedness…"
                  aria-label="Ask the AI assistant"
                  maxLength={2000}
                  className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fg-muted)]"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  aria-label="Send message"
                  className="focus-ring flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[var(--accent)] text-white hc:text-black transition-all hover:brightness-110 disabled:opacity-40"
                >
                  <Send size={15} aria-hidden="true" />
                </button>
              </div>
            </form>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
