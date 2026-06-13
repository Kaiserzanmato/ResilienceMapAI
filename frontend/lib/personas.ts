export interface Persona {
  key: string;
  label: string;
  emoji: string;
  description: string;
  suggestedQueries: string[];
}

export const PERSONAS: Persona[] = [
  {
    key: "citizen",
    label: "Citizen",
    emoji: "🏠",
    description: "Family safety and preparedness",
    suggestedQueries: [
      "Is this area safe to live in?",
      "What should my family prepare?",
      "What hazards should I monitor?",
    ],
  },
  {
    key: "real_estate",
    label: "Real Estate",
    emoji: "🏢",
    description: "Property due diligence",
    suggestedQueries: [
      "What are the property risk concerns here?",
      "What due diligence should I request?",
      "Compare this location with another area.",
    ],
  },
  {
    key: "insurance",
    label: "Insurance / Fintech",
    emoji: "📊",
    description: "Underwriting and collateral risk",
    suggestedQueries: [
      "What underwriting flags apply here?",
      "What hazards affect collateral risk?",
      "Generate a risk memo for this location.",
    ],
  },
  {
    key: "government",
    label: "Government",
    emoji: "🏛️",
    description: "Community and infrastructure planning",
    suggestedQueries: [
      "Which communities should be prioritized?",
      "What infrastructure is exposed?",
      "Generate an executive briefing.",
    ],
  },
  {
    key: "ngo",
    label: "NGO",
    emoji: "🤝",
    description: "Humanitarian preparedness programs",
    suggestedQueries: [
      "Which areas need preparedness support?",
      "Generate a program justification.",
      "What vulnerable communities are exposed?",
    ],
  },
  {
    key: "business",
    label: "Business",
    emoji: "💼",
    description: "Continuity and supply chain",
    suggestedQueries: [
      "What continuity risks affect operations here?",
      "How exposed is my supply chain in this region?",
      "Generate a business continuity brief.",
    ],
  },
  {
    key: "school",
    label: "School",
    emoji: "🎓",
    description: "Campus and student safety",
    suggestedQueries: [
      "What hazards affect school safety here?",
      "What drills should we prioritize?",
      "Generate a school safety brief.",
    ],
  },
];

export function getPersona(key: string): Persona {
  return PERSONAS.find((p) => p.key === key) ?? PERSONAS[0];
}
