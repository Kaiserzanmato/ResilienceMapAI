"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ChatMessage, RiskAssessment } from "./types";
import type { EvacuationCenterWithDistance } from "./evacuation-centers";

export interface SelectedLocation {
  lat: number;
  lng: number;
  name?: string;
  countryCode?: string;
}

/**
 * MapTarget: Unified state for map selection + AI agent context injection.
 * Aligns with global data routing architecture per resilience_map_architecture.pdf.
 */
export interface MapTarget {
  latitude: number;
  longitude: number;
  cityName: string;
  countryCode: string;
  hazardScores: number[]; // Compressed array format: [0:Flood, 1:EQ, 2:TC, ...]
  officialSources: string[]; // Routed sources for this location
  timestamp: number; // For cache invalidation
}

/** 2D web-mercator map or MapLibre's 3D globe; both share every overlay. */
export type MapProjection = "mercator" | "globe";

interface AppState {
  persona: string;
  setPersona: (p: string) => void;

  selected: SelectedLocation | null;
  setSelected: (loc: SelectedLocation | null) => void;

  risk: RiskAssessment | null;
  setRisk: (r: RiskAssessment | null) => void;

  // Unified MapTarget for AI agent alignment (architecture: resilience_map_architecture.pdf)
  activeTarget: MapTarget | null;
  setActiveTarget: (target: MapTarget | null) => void;

  // True while the top-nav persona dropdown is open. The dropdown and the
  // map's RiskSummaryWidget are positioned independently and can overlap at
  // narrower viewports — widgets that might sit underneath read this to
  // hide themselves while the dropdown is open, rather than each floating
  // panel needing to know about every other one's position.
  personaMenuOpen: boolean;
  setPersonaMenuOpen: (open: boolean) => void;

  // AI panel
  aiOpen: boolean;
  aiPanelWidth: number;
  aiPinned: boolean;
  setAiOpen: (open: boolean) => void;
  setAiPanelWidth: (width: number) => void;
  setAiPinned: (pinned: boolean) => void;
  messages: ChatMessage[];
  addMessage: (m: ChatMessage) => void;
  clearMessages: () => void;

  // Map state
  mapView: string;
  setMapView: (v: string) => void;
  mapProjection: MapProjection;
  setMapProjection: (p: MapProjection) => void;
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
  showEvacuationCenters: boolean;
  setShowEvacuationCenters: (b: boolean) => void;
  selectedEvacuationCenter: EvacuationCenterWithDistance | null;
  setSelectedEvacuationCenter: (c: EvacuationCenterWithDistance | null) => void;

  // CTA state for map command bar micro-interactions
  assessmentLoading: boolean;
  setAssessmentLoading: (b: boolean) => void;
  assessmentSuccess: boolean;
  setAssessmentSuccess: (b: boolean) => void;
  assessmentError: boolean;
  setAssessmentError: (b: boolean) => void;
  lastAssessmentCoords: [number, number] | null;
  setLastAssessmentCoords: (coords: [number, number] | null) => void;
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

      activeTarget: null,
      setActiveTarget: (activeTarget) => set({ activeTarget }),

      personaMenuOpen: false,
      setPersonaMenuOpen: (personaMenuOpen) => set({ personaMenuOpen }),

      aiOpen: false,
      aiPanelWidth: 400,
      aiPinned: false,
      setAiOpen: (aiOpen) => set({ aiOpen }),
      setAiPanelWidth: (aiPanelWidth) => set({ aiPanelWidth }),
      setAiPinned: (aiPinned) => set({ aiPinned }),
      messages: [],
      addMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),
      clearMessages: () => set({ messages: [] }),

      mapView: "dark",
      setMapView: (mapView) => set({ mapView }),
      mapProjection: "mercator",
      setMapProjection: (mapProjection) => set({ mapProjection }),
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
      showEvacuationCenters: false,
      setShowEvacuationCenters: (showEvacuationCenters) => set({ showEvacuationCenters }),
      selectedEvacuationCenter: null,
      setSelectedEvacuationCenter: (selectedEvacuationCenter) => set({ selectedEvacuationCenter }),

      assessmentLoading: false,
      setAssessmentLoading: (assessmentLoading) => set({ assessmentLoading }),
      assessmentSuccess: false,
      setAssessmentSuccess: (assessmentSuccess) => set({ assessmentSuccess }),
      assessmentError: false,
      setAssessmentError: (assessmentError) => set({ assessmentError }),
      lastAssessmentCoords: null,
      setLastAssessmentCoords: (lastAssessmentCoords) => set({ lastAssessmentCoords }),
    }),
    {
      name: "resiliencemap-state",
      partialize: (s) => ({
        persona: s.persona,
        mapView: s.mapView,
        mapProjection: s.mapProjection,
        activeLayer: s.activeLayer,
        aiPinned: s.aiPinned,
        selected: s.selected,
        activeTarget: s.activeTarget,
      }),
    }
  )
);
