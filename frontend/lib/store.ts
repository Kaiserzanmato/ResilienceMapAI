"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, RiskAssessment } from "./types";

export interface SelectedLocation {
  lat: number;
  lng: number;
  name?: string;
  countryCode?: string;
}

interface AppState {
  persona: string;
  setPersona: (p: string) => void;

  selected: SelectedLocation | null;
  setSelected: (loc: SelectedLocation | null) => void;

  risk: RiskAssessment | null;
  setRisk: (r: RiskAssessment | null) => void;

  // AI panel
  aiOpen: boolean;
  aiPinned: boolean;
  setAiOpen: (open: boolean) => void;
  setAiPinned: (pinned: boolean) => void;
  messages: ChatMessage[];
  addMessage: (m: ChatMessage) => void;
  clearMessages: () => void;

  // Map state
  mapView: string;
  setMapView: (v: string) => void;
  activeLayer: string;
  setActiveLayer: (l: string) => void;
  showHeatmap: boolean;
  setShowHeatmap: (b: boolean) => void;
  showZones: boolean;
  setShowZones: (b: boolean) => void;
  showAlerts: boolean;
  setShowAlerts: (b: boolean) => void;
  showEvents: boolean;
  setShowEvents: (b: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      persona: "citizen",
      setPersona: (persona) => set({ persona }),

      selected: null,
      setSelected: (selected) => set({ selected }),

      risk: null,
      setRisk: (risk) => set({ risk }),

      aiOpen: false,
      aiPinned: false,
      setAiOpen: (aiOpen) => set({ aiOpen }),
      setAiPinned: (aiPinned) => set({ aiPinned }),
      messages: [],
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      clearMessages: () => set({ messages: [] }),

      mapView: "dark",
      setMapView: (mapView) => set({ mapView }),
      activeLayer: "overall",
      setActiveLayer: (activeLayer) => set({ activeLayer }),
      showHeatmap: true,
      setShowHeatmap: (showHeatmap) => set({ showHeatmap }),
      showZones: true,
      setShowZones: (showZones) => set({ showZones }),
      showAlerts: true,
      setShowAlerts: (showAlerts) => set({ showAlerts }),
      showEvents: false,
      setShowEvents: (showEvents) => set({ showEvents }),
    }),
    {
      name: "resiliencemap-state",
      partialize: (s) => ({
        persona: s.persona,
        mapView: s.mapView,
        activeLayer: s.activeLayer,
        aiPinned: s.aiPinned,
        selected: s.selected,
      }),
    }
  )
);
