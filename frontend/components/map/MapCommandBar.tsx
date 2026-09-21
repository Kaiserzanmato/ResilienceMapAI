"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, CheckCircle2, Zap, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

interface LocationOption {
  name: string;
  lat: number;
  lng: number;
  riskLevel?: "low" | "medium" | "high";
}

const PRESET_LOCATIONS: LocationOption[] = [
  { name: "Tacloban City", lat: 11.2800, lng: 124.9900, riskLevel: "high" },
  { name: "Legazpi", lat: 13.1467, lng: 123.7368, riskLevel: "medium" },
  { name: "New Orleans", lat: 29.9511, lng: -90.2623, riskLevel: "high" },
  { name: "Manila", lat: 14.5995, lng: 120.9842, riskLevel: "medium" },
];

export function MapCommandBar() {
  const {
    selected,
    setSelected,
    assessmentLoading,
    setAssessmentLoading,
    assessmentSuccess,
    setAssessmentSuccess,
    setLastAssessmentCoords,
  } = useAppStore();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationOption | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!dropdownRef.current?.contains(e.target as Node)) setDropdownOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const handleLocationSelect = (loc: LocationOption) => {
    setSelectedLocation(loc);
    setSelected({ lat: loc.lat, lng: loc.lng, name: loc.name });
    setDropdownOpen(false);
  };

  const handleRunAssessment = async () => {
    if (!selectedLocation && !selected) return;

    const target = selectedLocation || selected;
    if (!target) return;

    setAssessmentLoading(true);
    setAssessmentSuccess(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setAssessmentSuccess(true);
      setLastAssessmentCoords([target.lat, target.lng]);
      setTimeout(() => setAssessmentSuccess(false), 2500);
    } finally {
      setAssessmentLoading(false);
    }
  };

  const locationRiskMap = useMemo(
    () => new Map(PRESET_LOCATIONS.map((l) => [l.name, l.riskLevel])),
    []
  );

  const currentLocation = selectedLocation || selected;
  const riskLevel = selectedLocation?.riskLevel || (currentLocation?.name ? locationRiskMap.get(currentLocation.name) : undefined);

  const riskColors = {
    low: "from-green-500 to-green-600",
    medium: "from-amber-500 to-amber-600",
    high: "from-red-500 to-red-600",
  };

  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-[calc(var(--banner-h,0px)+var(--nav-h,0px)+24px)] left-1/2 z-40 -translate-x-1/2"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <div className="pointer-events-auto flex gap-3 flex-col sm:flex-row items-center">
          {/* Location Picker Dropdown */}
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className={cn(
                "glass-strong flex items-center gap-2.5 px-4 py-3 rounded-2xl transition-all duration-200",
                "hover:bg-[color-mix(in_srgb,var(--surface-solid)_92%,transparent)]",
                riskLevel && `ring-2 ring-offset-2 ring-offset-[var(--bg)]`,
                riskLevel === "high" && "ring-red-500/60",
                riskLevel === "medium" && "ring-amber-500/60",
                riskLevel === "low" && "ring-green-500/60"
              )}
              aria-expanded={dropdownOpen}
              aria-label="Select target location"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">
                  {currentLocation?.name || "Select location…"}
                </span>
                {riskLevel && (
                  <motion.span
                    className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      riskLevel === "high" && "bg-red-500",
                      riskLevel === "medium" && "bg-amber-500",
                      riskLevel === "low" && "bg-green-500"
                    )}
                    animate={{
                      opacity: riskLevel === "high" ? [1, 0.5, 1] : 1,
                    }}
                    transition={{
                      duration: riskLevel === "high" ? 1.5 : 0,
                      repeat: riskLevel === "high" ? Infinity : 0,
                    }}
                  />
                )}
              </div>
              <motion.div animate={{ rotate: dropdownOpen ? 180 : 0 }} transition={{ duration: 0.2 }}>
                <ChevronDown size={16} className="text-[var(--fg-muted)] shrink-0" />
              </motion.div>
            </button>

            {dropdownOpen && (
              <motion.div
                className="glass-strong absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-50"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <ul className="py-1.5 max-h-64 overflow-y-auto">
                  {PRESET_LOCATIONS.map((loc) => (
                    <li key={`${loc.name}-${loc.lat}`}>
                      <button
                        onClick={() => handleLocationSelect(loc)}
                        className={cn(
                          "w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition-colors text-sm",
                          "hover:bg-[color-mix(in_srgb,var(--fg)_8%,transparent)]",
                          currentLocation?.name === loc.name && "bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
                        )}
                      >
                        <span className="flex-1 font-medium">{loc.name}</span>
                        {loc.riskLevel && (
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              loc.riskLevel === "high" && "bg-red-500",
                              loc.riskLevel === "medium" && "bg-amber-500",
                              loc.riskLevel === "low" && "bg-green-500"
                            )}
                          />
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </motion.div>
            )}
          </div>

          {/* CTA Button with Micro-Interactions */}
          <motion.button
            onClick={handleRunAssessment}
            disabled={!currentLocation || assessmentLoading}
            className={cn(
              "glass-strong relative px-5 py-3 rounded-2xl font-medium text-sm transition-all duration-200",
              "focus-ring disabled:opacity-50 disabled:cursor-not-allowed",
              "overflow-hidden whitespace-nowrap"
            )}
            whileHover={!assessmentLoading && currentLocation ? { scale: 1.02 } : {}}
            whileTap={!assessmentLoading && currentLocation ? { scale: 0.98 } : {}}
          >
            {/* Background gradient for states */}
            <motion.div
              className={cn(
                "absolute inset-0 rounded-2xl -z-10 transition-all duration-300",
                assessmentSuccess
                  ? "bg-gradient-to-r from-green-500 to-green-600"
                  : riskLevel === "high"
                    ? "bg-gradient-to-r from-red-500/20 to-red-600/20"
                    : riskLevel === "medium"
                      ? "bg-gradient-to-r from-amber-500/20 to-amber-600/20"
                      : "bg-gradient-to-r from-transparent to-transparent"
              )}
            />

            {/* Pulsing ring on success */}
            {assessmentSuccess && (
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-green-500"
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 1.3, opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
            )}

            {/* Content */}
            <div className="flex items-center justify-center gap-2 h-6 relative z-10">
              <motion.div
                animate={{
                  scale: assessmentLoading ? 1 : 1,
                  opacity: assessmentLoading ? 1 : 0,
                }}
                transition={{ duration: 0.2 }}
                className="absolute"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  className="flex items-center"
                >
                  <div className="w-4 h-4 border-2 border-[var(--accent)] border-t-transparent rounded-full" />
                </motion.div>
              </motion.div>

              <motion.div
                animate={{
                  opacity: assessmentLoading ? 0 : 1,
                  scale: assessmentLoading ? 0.8 : 1,
                }}
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

              {/* Phase text during loading */}
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

          {/* Help tooltip */}
          {!currentLocation && (
            <motion.div
              className="absolute -bottom-8 left-1/2 -translate-x-1/2 text-xs text-[var(--fg-muted)] whitespace-nowrap"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.5 }}
            >
              Select a location to begin
            </motion.div>
          )}
        </div>
      </motion.div>

      <style jsx global>{`
        @keyframes spatial-ripple {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(3);
            opacity: 0;
          }
        }

        .spatial-ripple {
          animation: spatial-ripple 1.6s ease-out;
        }
      `}</style>
    </>
  );
}
