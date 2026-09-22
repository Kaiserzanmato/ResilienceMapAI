"use client";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2, MapPin, Search, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { parseCoordinates, getLocationCountryAlpha2 } from "@/lib/locations/geocoding";

const RISK_COLOR_CLASSES: Record<string, string> = {
  red: "bg-red-500",
  yellow: "bg-amber-500",
  green: "bg-green-500",
  gray: "bg-neutral-400",
};

const RISK_RING_CLASSES: Record<string, string> = {
  red: "ring-red-500/60",
  yellow: "ring-amber-500/60",
  green: "ring-green-500/60",
  gray: "",
};

const RISK_GRADIENT_CLASSES: Record<string, string> = {
  red: "bg-gradient-to-r from-red-500/20 to-red-600/20",
  yellow: "bg-gradient-to-r from-amber-500/20 to-amber-600/20",
  green: "bg-gradient-to-r from-green-500/20 to-green-600/20",
  gray: "bg-gradient-to-r from-transparent to-transparent",
};

export function MapCommandBar() {
  const {
    selected,
    setSelected,
    risk,
    assessmentLoading,
    setAssessmentLoading,
    assessmentSuccess,
    setAssessmentSuccess,
    setLastAssessmentCoords,
  } = useAppStore();

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 280);
    return () => clearTimeout(t);
  }, [query]);

  const { data, isFetching } = useQuery({
    queryKey: ["command-bar-geocode", debounced],
    queryFn: async () => {
      if (!debounced.trim()) return { results: [] };
      const coordMatch = parseCoordinates(debounced);
      if (coordMatch) return { results: [coordMatch] };
      return api.geocode(debounced);
    },
    enabled: debounced.trim().length >= 2,
  });
  const results = data?.results ?? [];

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const riskColor = selected ? risk?.overall.color : undefined;

  const handleSelect = (r: { lat: number; lng: number; name: string; formatted_address?: string; display_name?: string; country?: string }) => {
    const countryCode = getLocationCountryAlpha2(r);
    setSelected({ lat: r.lat, lng: r.lng, name: r.name, countryCode });
    setQuery("");
    setOpen(false);
  };

  const handleRunAssessment = async () => {
    if (!selected) return;
    setAssessmentLoading(true);
    setAssessmentSuccess(false);
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setAssessmentSuccess(true);
      setLastAssessmentCoords([selected.lat, selected.lng]);
      setTimeout(() => setAssessmentSuccess(false), 2500);
    } finally {
      setAssessmentLoading(false);
    }
  };

  return (
    <motion.div
      className="pointer-events-none fixed top-[calc(var(--banner-h,0px)+var(--nav-h,0px)+24px)] left-1/2 z-40 -translate-x-1/2"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
    >
      <div className="pointer-events-auto flex flex-col items-center gap-3 sm:flex-row">
        {/* Unified location search / current-selection combobox */}
        <div ref={ref} className="relative w-64">
          <button
            onClick={() => setOpen((v) => !v)}
            className={cn(
              "glass-strong flex w-full items-center gap-2.5 rounded-2xl px-4 py-3 transition-all duration-200",
              "hover:bg-[color-mix(in_srgb,var(--surface-solid)_92%,transparent)]",
              riskColor && "ring-2 ring-offset-2 ring-offset-[var(--bg)]",
              riskColor && RISK_RING_CLASSES[riskColor]
            )}
            aria-expanded={open}
            aria-label="Search or select a location"
          >
            <Search size={15} className="shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">
              {selected?.name || "Search a location…"}
            </span>
            {riskColor && (
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", RISK_COLOR_CLASSES[riskColor])}
                aria-hidden="true"
              />
            )}
            <ChevronDown
              size={15}
              className={cn("shrink-0 text-[var(--fg-muted)] transition-transform", open && "rotate-180")}
              aria-hidden="true"
            />
          </button>

          {open && (
            <motion.div
              className="glass-strong absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl p-2"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
            >
              <div className="mb-1.5 flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] px-3 py-2">
                {isFetching ? (
                  <Loader2 size={14} className="shrink-0 animate-spin text-[var(--accent)]" aria-hidden="true" />
                ) : (
                  <Search size={14} className="shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
                )}
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter location…"
                  aria-label="Filter location"
                  className="w-full flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--fg-muted)]"
                />
              </div>
              <ul className="max-h-64 space-y-0.5 overflow-y-auto" role="listbox" aria-label="Search results">
                {results.length > 0 ? (
                  results.map((r) => (
                    <li key={`${r.name}-${r.lat}`}>
                      <button
                        role="option"
                        aria-selected="false"
                        onClick={() => handleSelect(r)}
                        className="focus-ring flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]"
                      >
                        <MapPin size={14} className="shrink-0 text-[var(--accent)]" aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{r.name}</span>
                          <span className="block truncate text-xs text-[var(--fg-muted)]">
                            {r.formatted_address || r.display_name || r.country || "Address unavailable"}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="px-3 py-2.5 text-center text-xs text-[var(--fg-muted)]">
                    {debounced.trim().length >= 2 ? "No locations found" : "Type at least 2 characters to search"}
                  </li>
                )}
              </ul>
            </motion.div>
          )}
        </div>

        {/* CTA Button with micro-interactions */}
        <motion.button
          onClick={handleRunAssessment}
          disabled={!selected || assessmentLoading}
          className={cn(
            "glass-strong relative overflow-hidden whitespace-nowrap rounded-2xl px-5 py-3 text-sm font-medium transition-all duration-200",
            "focus-ring disabled:cursor-not-allowed disabled:opacity-50"
          )}
          whileHover={!assessmentLoading && selected ? { scale: 1.02 } : {}}
          whileTap={!assessmentLoading && selected ? { scale: 0.98 } : {}}
        >
          <motion.div
            className={cn(
              "absolute inset-0 -z-10 rounded-2xl transition-all duration-300",
              assessmentSuccess
                ? "bg-gradient-to-r from-green-500 to-green-600"
                : (riskColor && RISK_GRADIENT_CLASSES[riskColor]) || RISK_GRADIENT_CLASSES.gray
            )}
          />

          {assessmentSuccess && (
            <motion.div
              className="absolute inset-0 rounded-2xl border-2 border-green-500"
              initial={{ scale: 0.8, opacity: 1 }}
              animate={{ scale: 1.3, opacity: 0 }}
              transition={{ duration: 0.6 }}
            />
          )}

          <div className="relative z-10 flex h-6 items-center justify-center gap-2">
            <motion.div
              animate={{ opacity: assessmentLoading ? 1 : 0 }}
              transition={{ duration: 0.2 }}
              className="absolute"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                className="flex items-center"
              >
                <div className="h-4 w-4 rounded-full border-2 border-[var(--accent)] border-t-transparent" />
              </motion.div>
            </motion.div>

            <motion.div
              animate={{ opacity: assessmentLoading ? 0 : 1, scale: assessmentLoading ? 0.8 : 1 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2"
            >
              {assessmentSuccess ? (
                <>
                  <CheckCircle2 size={16} className="text-green-500" />
                  <span>Assessment complete</span>
                </>
              ) : (
                <>
                  <Zap size={16} />
                  <span>Run AI Risk Assessment</span>
                </>
              )}
            </motion.div>

            {assessmentLoading && (
              <motion.span
                className="absolute text-xs opacity-75"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Analyzing layers…
              </motion.span>
            )}
          </div>
        </motion.button>

        {!selected && (
          <motion.div
            className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs text-[var(--fg-muted)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.5 }}
          >
            Select a location to begin
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
