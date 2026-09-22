export interface EvacuationCenter {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  type: "school" | "gymnasium" | "covered_court" | "barangay_hall" | "government_building";
  capacityStatus: "Open" | "Near Capacity" | "Full" | "Standby";
  safetyInstructions: string[];
}

export interface EvacuationCenterWithDistance extends EvacuationCenter {
  distanceKm: number;
}

// Curated set of major regional evacuation sites (DPWH/NDRRMC-designated
// facility types) spanning key Philippine regions. Indicative locations for
// demo/planning purposes — always confirm the active center with local DRRM
// offices before relying on this for a real evacuation.
export const EVACUATION_CENTERS: EvacuationCenter[] = [
  {
    id: "tanza-nchs",
    name: "Tanza National Comprehensive High School",
    address: "A. Soriano Highway, Tanza, Cavite, Philippines",
    lat: 14.3958,
    lng: 120.8578,
    type: "school",
    capacityStatus: "Open",
    safetyInstructions: [
      "Avoid low-lying coastal roads.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
      "Follow barangay tanod directions for registration on arrival.",
    ],
  },
  {
    id: "amoranto-sports-complex",
    name: "Amoranto Sports Complex",
    address: "Retiro St, Santa Mesa Heights, Quezon City, Metro Manila, Philippines",
    lat: 14.6255,
    lng: 120.9938,
    type: "gymnasium",
    capacityStatus: "Open",
    safetyInstructions: [
      "Use the Retiro St entrance — main gate may be gridlocked during flooding.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
      "Report to the registration desk immediately upon arrival.",
    ],
  },
  {
    id: "marikina-sports-center",
    name: "Marikina Sports Center",
    address: "Shoe Ave, Marikina City, Metro Manila, Philippines",
    lat: 14.6355,
    lng: 121.1029,
    type: "gymnasium",
    capacityStatus: "Near Capacity",
    safetyInstructions: [
      "Avoid Marikina River esplanade and low bridges during heavy rainfall.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
      "Elderly and PWD registration is prioritized at the east entrance.",
    ],
  },
  {
    id: "albay-astrodome",
    name: "Albay Astrodome",
    address: "Bonifacio Dr, Legazpi City, Albay, Philippines",
    lat: 13.1391,
    lng: 123.7438,
    type: "covered_court",
    capacityStatus: "Open",
    safetyInstructions: [
      "Stay clear of Mayon Volcano's 6-km permanent danger zone en route.",
      "Bring valid ID, emergency kit, dust mask, and 3 days of water/food.",
      "Monitor PHIVOLCS bulletins for lahar advisories along access roads.",
    ],
  },
  {
    id: "naga-city-coliseum",
    name: "Naga City Coliseum",
    address: "Magsaysay Ave, Naga City, Camarines Sur, Philippines",
    lat: 13.6218,
    lng: 123.1948,
    type: "covered_court",
    capacityStatus: "Standby",
    safetyInstructions: [
      "Avoid Naga River and Bicol River floodplain roads during storm surges.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
    ],
  },
  {
    id: "tacloban-astrodome",
    name: "Tacloban Astrodome",
    address: "Real St, Barangay 72, Tacloban City, Leyte, Philippines",
    lat: 11.2447,
    lng: 125.0048,
    type: "covered_court",
    capacityStatus: "Open",
    safetyInstructions: [
      "Storm surge history is severe here — evacuate early ahead of typhoon landfall, do not wait for the surge itself.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
      "Coordinate with barangay officials for family reunification points.",
    ],
  },
  {
    id: "auf-gymnasium",
    name: "Angeles University Foundation Gymnasium",
    address: "MacArthur Highway, Angeles City, Pampanga, Philippines",
    lat: 15.1449,
    lng: 120.5887,
    type: "gymnasium",
    capacityStatus: "Open",
    safetyInstructions: [
      "Avoid low-lying areas near the Abacan River during heavy rainfall.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
    ],
  },
  {
    id: "san-fernando-sports-center",
    name: "City of San Fernando Sports Center",
    address: "MacArthur Highway, City of San Fernando, Pampanga, Philippines",
    lat: 15.0286,
    lng: 120.6898,
    type: "government_building",
    capacityStatus: "Standby",
    safetyInstructions: [
      "Bring valid ID, emergency kit, and 3 days of water/food.",
      "Follow LGU advisories on lahar-prone routes near the Sacobia-Bamban-Parua river system.",
    ],
  },
  {
    id: "pasig-city-sports-center",
    name: "Pasig City Sports Center",
    address: "Caruncho Ave, Pasig City, Metro Manila, Philippines",
    lat: 14.5645,
    lng: 121.0793,
    type: "gymnasium",
    capacityStatus: "Open",
    safetyInstructions: [
      "Avoid Pasig River esplanade roads during heavy rainfall.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
    ],
  },
  {
    id: "cdo-pelaez-sports-center",
    name: "Pelaez Sports Center",
    address: "Corrales Ave, Cagayan de Oro City, Misamis Oriental, Philippines",
    lat: 8.4822,
    lng: 124.6472,
    type: "gymnasium",
    capacityStatus: "Open",
    safetyInstructions: [
      "Avoid Cagayan de Oro River banks — flash flood risk during sustained heavy rain.",
      "Bring valid ID, emergency kit, and 3 days of water/food.",
    ],
  },
  {
    id: "barangay-hall-tagaytay",
    name: "Tagaytay City Barangay Hall — Poblacion",
    address: "Emilio Aguinaldo Highway, Tagaytay City, Cavite, Philippines",
    lat: 14.1035,
    lng: 120.9622,
    type: "barangay_hall",
    capacityStatus: "Standby",
    safetyInstructions: [
      "Stay outside Taal Volcano's Permanent Danger Zone at all times.",
      "Bring valid ID, emergency kit, dust mask, and 3 days of water/food.",
      "Follow PHIVOLCS alert-level guidance before any return to low-lying shoreline areas.",
    ],
  },
];

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in kilometers. */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth radius, km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Returns the `limit` nearest evacuation centers to the given coordinates, nearest first. */
export function getNearestEvacuationCenters(
  targetLat: number,
  targetLng: number,
  limit = 5
): EvacuationCenterWithDistance[] {
  return EVACUATION_CENTERS
    .map((center) => ({
      ...center,
      distanceKm: haversineDistanceKm(targetLat, targetLng, center.lat, center.lng),
    }))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}
