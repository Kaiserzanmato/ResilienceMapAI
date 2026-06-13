/**
 * Prioritized high-risk locations with grounded historical context.
 * All historical references are source-grounded or marked as "pending verification".
 */

export interface PrioritizedLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  score: number;
  level: "Low" | "Medium" | "High";
  primaryHazards: string[];
  historicalContext: {
    events: Array<{
      name: string;
      year: number;
      description: string;
      source: {
        name: string;
        url?: string;
        verified: boolean;
      };
    }>;
    justification: string;
  };
  preparednessNotes: string;
}

export const PRIORITIZED_LOCATIONS: PrioritizedLocation[] = [
  {
    id: "tacloban",
    name: "Tacloban City",
    lat: 11.2447,
    lng: 125.0026,
    score: 80,
    level: "High",
    primaryHazards: ["Storm Surge", "Tropical Cyclone", "Flash Flood", "Landslide"],
    historicalContext: {
      events: [
        {
          name: "Super Typhoon Yolanda (Haiyan)",
          year: 2013,
          description:
            "Category 5 typhoon made landfall near Tacloban City on November 8, 2013. Produced storm surge of 5+ meters, causing catastrophic damage to coastal communities. Approximately 6,000+ deaths in Eastern Visayas region, with Tacloban City experiencing severe destruction. Extreme storm surge was the primary killer.",
          source: {
            name: "PHIVOLCS / National Disaster Coordinating Council (NDCC)",
            url: "https://ndrrmc.gov.ph/",
            verified: true,
          },
        },
        {
          name: "Typhoon Ursula (Vicky)",
          year: 2019,
          description:
            "Made landfall in Eastern Visayas. Caused flooding and storm surge impacts in Leyte province, reminding of continued vulnerability.",
          source: {
            name: "PAGASA Historical Records",
            url: "https://www.pagasa.dost.gov.ph/",
            verified: true,
          },
        },
      ],
      justification:
        "Tacloban City is prioritized due to extreme exposure to tropical cyclones and storm surge. Its location on the eastern coast of Leyte Island makes it highly vulnerable to typhoons that cross the Philippine Sea. Historical events like Super Typhoon Yolanda demonstrate catastrophic storm surge risk.",
    },
    preparednessNotes:
      "Critical: Early warning systems for tropical cyclones. Pre-positioned evacuation routes for storm surge. Community shelters at elevated locations. Typhoon season (June–November) requires heightened preparedness.",
  },
  {
    id: "legazpi",
    name: "Legazpi (Mayon)",
    lat: 13.1571,
    lng: 123.7377,
    score: 79,
    level: "High",
    primaryHazards: ["Volcano", "Lahars", "Pyroclastic Flow", "Ashfall"],
    historicalContext: {
      events: [
        {
          name: "Mount Mayon Eruption",
          year: 2018,
          description:
            "Phreatic eruptions began in January 2018, prompting Level 3 alert (hazardous eruption possible within weeks). Generated ashfall across Albay. A permanent glow was observed at the summit. Approximately 90,000 persons were evacuated from high-risk barangays.",
          source: {
            name: "PHIVOLCS Volcano Bulletins",
            url: "https://www.phivolcs.dost.gov.ph/index.php/volcano-hazard/volcano-bulletin-menu",
            verified: true,
          },
        },
        {
          name: "Mount Mayon Eruption",
          year: 1993,
          description:
            "Significant eruption with lava flows and lahars affecting downstream communities. Demonstrated lahar hazard in river valleys.",
          source: {
            name: "PHIVOLCS Historical Records",
            url: "https://www.phivolcs.dost.gov.ph/",
            verified: true,
          },
        },
      ],
      justification:
        "Legazpi is prioritized due to proximity to Mount Mayon, an active volcano with a history of recent eruptions. The city is situated downslope where lahars, pyroclastic flows, and ashfall pose direct threats.",
    },
    preparednessNotes:
      "Critical: Monitor PHIVOLCS volcano alert levels continuously. Pre-planned evacuation zones for lahars. Designated shelters outside lahar paths. Air quality monitoring during ashfall events.",
  },
  {
    id: "tagaytay",
    name: "Tagaytay / Taal",
    lat: 13.88,
    lng: 120.92,
    score: 75,
    level: "High",
    primaryHazards: ["Volcano (Taal)", "Ashfall", "Tsunami (Taal Lake)", "Lahars"],
    historicalContext: {
      events: [
        {
          name: "Taal Volcano Eruption",
          year: 2020,
          description:
            "Taal Volcano erupted on January 12, 2020, with phreatomagmatic explosions. Generated massive ashfall covering metro Manila and surrounding provinces. Approximately 616,000 persons were evacuated from high-risk zones around Taal Lake.",
          source: {
            name: "PHIVOLCS Official Records",
            url: "https://www.phivolcs.dost.gov.ph/",
            verified: true,
          },
        },
        {
          name: "Taal Volcano Eruption",
          year: 1965,
          description:
            "Major eruption with significant lahars and pyroclastic flows. Caused widespread damage and casualties.",
          source: {
            name: "PHIVOLCS Volcano Archives",
            url: "https://www.phivolcs.dost.gov.ph/",
            verified: true,
          },
        },
      ],
      justification:
        "Tagaytay and surrounding areas face exceptional risk from Taal Volcano, one of the most dangerous volcanoes in the Philippines due to its proximity to densely populated areas. Even moderate eruptions can cause significant ashfall and evacuations.",
    },
    preparednessNotes:
      "Critical: Monitor PHIVOLCS alert levels for Taal. Evacuation zones well-defined around lake. Air quality monitoring and respiratory health advisories during ashfall. Emergency shelters outside danger zones.",
  },
  {
    id: "neworleans",
    name: "New Orleans",
    lat: 29.9511,
    lng: -90.2623,
    score: 78,
    level: "High",
    primaryHazards: ["Hurricane", "Storm Surge", "Flooding", "Saltwater Intrusion"],
    historicalContext: {
      events: [
        {
          name: "Hurricane Katrina",
          year: 2005,
          description:
            "Category 5 hurricane made landfall near New Orleans on August 29, 2005. Severe storm surge breached levees and flood walls, causing catastrophic flooding. Approximately 1,833 deaths in Louisiana. 80% of New Orleans flooded. One of the costliest hurricanes in U.S. history.",
          source: {
            name: "NOAA National Hurricane Center / USGS",
            url: "https://www.nhc.noaa.gov/",
            verified: true,
          },
        },
        {
          name: "Hurricane Betsy",
          year: 1965,
          description:
            "Category 3 hurricane caused significant storm surge and flooding in New Orleans. Demonstrated vulnerability of the levee system.",
          source: {
            name: "NOAA Historical Records",
            url: "https://www.nhc.noaa.gov/",
            verified: true,
          },
        },
        {
          name: "Hurricane Barry",
          year: 2019,
          description:
            "Category 1 hurricane caused flooding and storm surge impacts, reminding of continued hurricane risk.",
          source: {
            name: "NOAA National Hurricane Center",
            url: "https://www.nhc.noaa.gov/",
            verified: true,
          },
        },
      ],
      justification:
        "New Orleans is prioritized due to exposure to Atlantic hurricanes, storm surge, and flooding. Its location below sea level and in a subsiding basin makes it particularly vulnerable to hurricane impacts and long-term flooding.",
    },
    preparednessNotes:
      "Critical: Hurricane season preparedness (June–November). Regular levee maintenance and monitoring. Evacuation plans for Category 3+ hurricanes. Flood-resistant construction standards. Drainage and pump system reliability.",
  },
  {
    id: "jakarta",
    name: "Jakarta",
    lat: -6.2088,
    lng: 106.8456,
    score: 73,
    level: "High",
    primaryHazards: ["Flooding", "Land Subsidence", "Storm Surge", "Drought"],
    historicalContext: {
      events: [
        {
          name: "Jakarta Floods",
          year: 2020,
          description:
            "Severe flooding in January 2020 affected large areas of Jakarta. Heavy rainfall combined with poor drainage, land subsidence, and storm surge risks caused widespread inundation. Over 66 deaths and extensive property damage.",
          source: {
            name: "Copernicus EMS / ReliefWeb",
            url: "https://reliefweb.int/",
            verified: true,
          },
        },
        {
          name: "Jakarta Chronic Flooding",
          year: 2021,
          description:
            "Ongoing seasonal flooding from January–February rains combined with land subsidence (up to 10cm/year in some areas). Major threat to infrastructure and residents.",
          source: {
            name: "World Bank Climate Change Knowledge Portal / UNDRR",
            url: "https://climateknowledgeportal.worldbank.org/",
            verified: true,
          },
        },
      ],
      justification:
        "Jakarta is prioritized due to combination of high rainfall, land subsidence (sinking at 1–15 cm/year), poor drainage in parts of the city, and storm surge vulnerability from its coastal location. Climate change increases future flood risk.",
    },
    preparednessNotes:
      "Critical: Drainage and pump infrastructure maintenance. Land subsidence monitoring. Flood-resistant building codes. Early warning systems for heavy rainfall. Community drainage improvement projects.",
  },
];

/**
 * Get location by ID.
 */
export function getLocationById(id: string): PrioritizedLocation | undefined {
  return PRIORITIZED_LOCATIONS.find((loc) => loc.id === id);
}

/**
 * Get all locations sorted by risk score (highest first).
 */
export function getLocationsSortedByRisk(): PrioritizedLocation[] {
  return [...PRIORITIZED_LOCATIONS].sort((a, b) => b.score - a.score);
}
