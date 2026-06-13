"""Curated MVP sample hazard dataset.

Scores are indicative values (0-100) derived from public hazard literature for
each area (PHIVOLCS / PAGASA / USGS / NOAA / World Bank ThinkHazard categories).
They are deterministic inputs to the scoring engine — the AI layer never
invents or alters them.

hazards keys: flood, earthquake, tropical_cyclone, volcano, landslide, storm_surge
"""

HAZARD_KEYS = [
    "flood",
    "earthquake",
    "tropical_cyclone",
    "volcano",
    "landslide",
    "storm_surge",
]

HAZARD_LABELS = {
    "flood": "Flood",
    "earthquake": "Earthquake",
    "tropical_cyclone": "Tropical Cyclone",
    "volcano": "Volcanic Activity",
    "landslide": "Landslide",
    "storm_surge": "Storm Surge",
}

# Each zone: name, lat, lng, radius_km (core influence), population, hazard scores.
HAZARD_ZONES = [
    {
        "id": "mnl", "name": "Metro Manila", "country": "Philippines",
        "lat": 14.5995, "lng": 120.9842, "radius_km": 30, "population": 13_484_000,
        "critical_facilities": 412, "schools": 2890, "hospitals": 182,
        "hazards": {"flood": 78, "earthquake": 72, "tropical_cyclone": 70,
                    "volcano": 28, "landslide": 24, "storm_surge": 55},
    },
    {
        "id": "ceb", "name": "Cebu City", "country": "Philippines",
        "lat": 10.3157, "lng": 123.8854, "radius_km": 25, "population": 964_000,
        "critical_facilities": 96, "schools": 410, "hospitals": 38,
        "hazards": {"flood": 52, "earthquake": 58, "tropical_cyclone": 64,
                    "volcano": 8, "landslide": 41, "storm_surge": 47},
    },
    {
        "id": "dvo", "name": "Davao City", "country": "Philippines",
        "lat": 7.1907, "lng": 125.4553, "radius_km": 28, "population": 1_777_000,
        "critical_facilities": 120, "schools": 520, "hospitals": 41,
        "hazards": {"flood": 49, "earthquake": 61, "tropical_cyclone": 26,
                    "volcano": 18, "landslide": 38, "storm_surge": 30},
    },
    {
        "id": "tac", "name": "Tacloban City", "country": "Philippines",
        "lat": 11.2447, "lng": 125.0026, "radius_km": 22, "population": 251_000,
        "critical_facilities": 34, "schools": 130, "hospitals": 11,
        "hazards": {"flood": 66, "earthquake": 55, "tropical_cyclone": 88,
                    "volcano": 5, "landslide": 33, "storm_surge": 92},
    },
    {
        "id": "lgz", "name": "Legazpi (Mayon)", "country": "Philippines",
        "lat": 13.1391, "lng": 123.7438, "radius_km": 24, "population": 209_000,
        "critical_facilities": 28, "schools": 110, "hospitals": 9,
        "hazards": {"flood": 58, "earthquake": 52, "tropical_cyclone": 79,
                    "volcano": 86, "landslide": 57, "storm_surge": 61},
    },
    {
        "id": "bag", "name": "Baguio City", "country": "Philippines",
        "lat": 16.4023, "lng": 120.5960, "radius_km": 18, "population": 366_000,
        "critical_facilities": 42, "schools": 160, "hospitals": 14,
        "hazards": {"flood": 35, "earthquake": 74, "tropical_cyclone": 66,
                    "volcano": 6, "landslide": 81, "storm_surge": 2},
    },
    {
        "id": "tgt", "name": "Tagaytay / Taal", "country": "Philippines",
        "lat": 14.0954, "lng": 120.9367, "radius_km": 20, "population": 85_000,
        "critical_facilities": 14, "schools": 52, "hospitals": 4,
        "hazards": {"flood": 26, "earthquake": 63, "tropical_cyclone": 62,
                    "volcano": 90, "landslide": 44, "storm_surge": 4},
    },
    {
        "id": "ilo", "name": "Iloilo City", "country": "Philippines",
        "lat": 10.7202, "lng": 122.5621, "radius_km": 20, "population": 457_000,
        "critical_facilities": 50, "schools": 190, "hospitals": 17,
        "hazards": {"flood": 71, "earthquake": 47, "tropical_cyclone": 68,
                    "volcano": 4, "landslide": 18, "storm_surge": 58},
    },
    {
        "id": "zam", "name": "Zamboanga City", "country": "Philippines",
        "lat": 6.9214, "lng": 122.0790, "radius_km": 24, "population": 977_000,
        "critical_facilities": 71, "schools": 320, "hospitals": 21,
        "hazards": {"flood": 44, "earthquake": 57, "tropical_cyclone": 18,
                    "volcano": 7, "landslide": 29, "storm_surge": 36},
    },
    {
        "id": "tok", "name": "Tokyo", "country": "Japan",
        "lat": 35.6762, "lng": 139.6503, "radius_km": 45, "population": 13_960_000,
        "critical_facilities": 980, "schools": 4200, "hospitals": 640,
        "hazards": {"flood": 56, "earthquake": 84, "tropical_cyclone": 58,
                    "volcano": 32, "landslide": 21, "storm_surge": 49},
    },
    {
        "id": "jkt", "name": "Jakarta", "country": "Indonesia",
        "lat": -6.2088, "lng": 106.8456, "radius_km": 35, "population": 10_560_000,
        "critical_facilities": 540, "schools": 3100, "hospitals": 190,
        "hazards": {"flood": 86, "earthquake": 62, "tropical_cyclone": 12,
                    "volcano": 38, "landslide": 26, "storm_surge": 63},
    },
    {
        "id": "sfo", "name": "San Francisco", "country": "United States",
        "lat": 37.7749, "lng": -122.4194, "radius_km": 30, "population": 874_000,
        "critical_facilities": 130, "schools": 410, "hospitals": 34,
        "hazards": {"flood": 31, "earthquake": 88, "tropical_cyclone": 4,
                    "volcano": 9, "landslide": 35, "storm_surge": 27},
    },
    {
        "id": "mia", "name": "Miami", "country": "United States",
        "lat": 25.7617, "lng": -80.1918, "radius_km": 30, "population": 442_000,
        "critical_facilities": 88, "schools": 260, "hospitals": 29,
        "hazards": {"flood": 74, "earthquake": 6, "tropical_cyclone": 87,
                    "volcano": 0, "landslide": 3, "storm_surge": 82},
    },
    {
        "id": "kat", "name": "Kathmandu", "country": "Nepal",
        "lat": 27.7172, "lng": 85.3240, "radius_km": 22, "population": 1_442_000,
        "critical_facilities": 95, "schools": 540, "hospitals": 48,
        "hazards": {"flood": 47, "earthquake": 91, "tropical_cyclone": 5,
                    "volcano": 1, "landslide": 68, "storm_surge": 0},
    },
    {
        "id": "wlg", "name": "Wellington", "country": "New Zealand",
        "lat": -41.2866, "lng": 174.7756, "radius_km": 20, "population": 215_000,
        "critical_facilities": 41, "schools": 120, "hospitals": 8,
        "hazards": {"flood": 38, "earthquake": 83, "tropical_cyclone": 22,
                    "volcano": 12, "landslide": 49, "storm_surge": 41},
    },
    {
        "id": "ist", "name": "Istanbul", "country": "Türkiye",
        "lat": 41.0082, "lng": 28.9784, "radius_km": 35, "population": 15_460_000,
        "critical_facilities": 720, "schools": 3900, "hospitals": 310,
        "hazards": {"flood": 42, "earthquake": 86, "tropical_cyclone": 3,
                    "volcano": 2, "landslide": 31, "storm_surge": 24},
    },
    {
        "id": "nol", "name": "New Orleans", "country": "United States",
        "lat": 29.9511, "lng": -90.0715, "radius_km": 28, "population": 384_000,
        "critical_facilities": 66, "schools": 210, "hospitals": 22,
        "hazards": {"flood": 89, "earthquake": 5, "tropical_cyclone": 81,
                    "volcano": 0, "landslide": 2, "storm_surge": 90},
    },
]

# Historical disaster events (sample, sourced from official records)
HAZARD_EVENTS = [
    {"id": "ev-haiyan", "name": "Super Typhoon Haiyan (Yolanda)", "type": "tropical_cyclone",
     "year": 2013, "lat": 11.24, "lng": 125.00, "location": "Tacloban, Philippines",
     "severity": "Critical", "source": "PAGASA / NDRRMC"},
    {"id": "ev-taal", "name": "Taal Volcano Eruption", "type": "volcano",
     "year": 2020, "lat": 14.01, "lng": 120.99, "location": "Batangas, Philippines",
     "severity": "High", "source": "PHIVOLCS"},
    {"id": "ev-luzon-eq", "name": "Luzon Earthquake (M7.8)", "type": "earthquake",
     "year": 1990, "lat": 15.68, "lng": 121.17, "location": "Nueva Ecija, Philippines",
     "severity": "Critical", "source": "PHIVOLCS / USGS"},
    {"id": "ev-ondoy", "name": "Tropical Storm Ketsana (Ondoy) Floods", "type": "flood",
     "year": 2009, "lat": 14.62, "lng": 121.06, "location": "Metro Manila, Philippines",
     "severity": "High", "source": "PAGASA"},
    {"id": "ev-bohol-eq", "name": "Bohol Earthquake (M7.2)", "type": "earthquake",
     "year": 2013, "lat": 9.86, "lng": 124.07, "location": "Bohol, Philippines",
     "severity": "High", "source": "PHIVOLCS"},
    {"id": "ev-mayon-18", "name": "Mayon Volcano Eruption", "type": "volcano",
     "year": 2018, "lat": 13.26, "lng": 123.69, "location": "Albay, Philippines",
     "severity": "Moderate", "source": "PHIVOLCS"},
    {"id": "ev-rai", "name": "Typhoon Rai (Odette)", "type": "tropical_cyclone",
     "year": 2021, "lat": 9.85, "lng": 126.05, "location": "Siargao / Visayas, Philippines",
     "severity": "Critical", "source": "PAGASA / NDRRMC"},
    {"id": "ev-tohoku", "name": "Tōhoku Earthquake & Tsunami (M9.1)", "type": "earthquake",
     "year": 2011, "lat": 38.30, "lng": 142.37, "location": "Tōhoku, Japan",
     "severity": "Critical", "source": "JMA / USGS"},
    {"id": "ev-katrina", "name": "Hurricane Katrina", "type": "tropical_cyclone",
     "year": 2005, "lat": 29.95, "lng": -90.07, "location": "New Orleans, United States",
     "severity": "Critical", "source": "NOAA"},
    {"id": "ev-gorkha", "name": "Gorkha Earthquake (M7.8)", "type": "earthquake",
     "year": 2015, "lat": 28.23, "lng": 84.73, "location": "Gorkha, Nepal",
     "severity": "Critical", "source": "USGS"},
    {"id": "ev-jkt-flood", "name": "Jakarta New Year Floods", "type": "flood",
     "year": 2020, "lat": -6.21, "lng": 106.85, "location": "Jakarta, Indonesia",
     "severity": "High", "source": "BNPB"},
    {"id": "ev-carina", "name": "Typhoon Gaemi (Carina) Floods", "type": "flood",
     "year": 2024, "lat": 14.60, "lng": 120.98, "location": "Metro Manila, Philippines",
     "severity": "High", "source": "PAGASA"},
]

# Active alert samples (would stream from official feeds in production)
ACTIVE_ALERTS = [
    {"id": "al-1", "title": "Tropical Cyclone Watch", "hazard": "tropical_cyclone",
     "area": "Eastern Visayas", "lat": 11.6, "lng": 125.4, "severity": "Medium",
     "issued": "2026-06-12T06:00:00Z", "source": "PAGASA"},
    {"id": "al-2", "title": "Taal Volcano Alert Level 1", "hazard": "volcano",
     "area": "Batangas", "lat": 14.01, "lng": 120.99, "severity": "Low",
     "issued": "2026-06-10T00:00:00Z", "source": "PHIVOLCS"},
    {"id": "al-3", "title": "Flood Advisory — Marikina River", "hazard": "flood",
     "area": "Metro Manila", "lat": 14.63, "lng": 121.10, "severity": "Medium",
     "issued": "2026-06-13T02:00:00Z", "source": "PAGASA"},
]

# Dataset registry (source provenance, shown in Data Source widgets)
DATASETS = [
    {"id": "ds-usgs-eq", "name": "USGS Earthquake Hazard Model", "agency": "USGS",
     "category": "earthquake", "updated": "2026-04-18", "confidence": "High",
     "url": "https://earthquake.usgs.gov/hazards/", "records": 12480, "status": "active"},
    {"id": "ds-pagasa-tc", "name": "PAGASA Tropical Cyclone Climatology", "agency": "PAGASA",
     "category": "tropical_cyclone", "updated": "2026-03-02", "confidence": "High",
     "url": "https://www.pagasa.dost.gov.ph/", "records": 3860, "status": "active"},
    {"id": "ds-phivolcs-vol", "name": "PHIVOLCS Volcano Monitoring", "agency": "PHIVOLCS",
     "category": "volcano", "updated": "2026-06-01", "confidence": "High",
     "url": "https://www.phivolcs.dost.gov.ph/", "records": 942, "status": "active"},
    {"id": "ds-noaa-ss", "name": "NOAA Storm Surge Inundation", "agency": "NOAA",
     "category": "storm_surge", "updated": "2026-01-22", "confidence": "Medium",
     "url": "https://www.noaa.gov/", "records": 5210, "status": "active"},
    {"id": "ds-copernicus-fl", "name": "Copernicus EMS Flood Mapping", "agency": "Copernicus / ESA",
     "category": "flood", "updated": "2026-05-14", "confidence": "High",
     "url": "https://emergency.copernicus.eu/", "records": 8920, "status": "active"},
    {"id": "ds-wb-th", "name": "World Bank ThinkHazard! Profiles", "agency": "World Bank / GFDRR",
     "category": "multi", "updated": "2025-11-30", "confidence": "Medium",
     "url": "https://thinkhazard.org/", "records": 19640, "status": "active"},
    {"id": "ds-nasa-landslide", "name": "NASA Global Landslide Catalog", "agency": "NASA",
     "category": "landslide", "updated": "2025-12-15", "confidence": "Medium",
     "url": "https://gpm.nasa.gov/landslides/", "records": 11033, "status": "active"},
]

# Lightweight gazetteer for the MVP location search (no external geocoder key needed)
GAZETTEER = [
    {"name": z["name"], "country": z["country"], "lat": z["lat"], "lng": z["lng"]}
    for z in HAZARD_ZONES
] + [
    {"name": "Quezon City", "country": "Philippines", "lat": 14.6760, "lng": 121.0437},
    {"name": "Makati", "country": "Philippines", "lat": 14.5547, "lng": 121.0244},
    {"name": "Marikina", "country": "Philippines", "lat": 14.6507, "lng": 121.1029},
    {"name": "Batangas City", "country": "Philippines", "lat": 13.7565, "lng": 121.0583},
    {"name": "Naga City", "country": "Philippines", "lat": 13.6218, "lng": 123.1948},
    {"name": "Puerto Princesa", "country": "Philippines", "lat": 9.7392, "lng": 118.7353},
    {"name": "Cagayan de Oro", "country": "Philippines", "lat": 8.4542, "lng": 124.6319},
    {"name": "Surigao City", "country": "Philippines", "lat": 9.7571, "lng": 125.5138},
    {"name": "Los Angeles", "country": "United States", "lat": 34.0522, "lng": -118.2437},
    {"name": "New York", "country": "United States", "lat": 40.7128, "lng": -74.0060},
    {"name": "London", "country": "United Kingdom", "lat": 51.5074, "lng": -0.1278},
    {"name": "Sydney", "country": "Australia", "lat": -33.8688, "lng": 151.2093},
    {"name": "Mexico City", "country": "Mexico", "lat": 19.4326, "lng": -99.1332},
    {"name": "Lisbon", "country": "Portugal", "lat": 38.7223, "lng": -9.1393},
    {"name": "Singapore", "country": "Singapore", "lat": 1.3521, "lng": 103.8198},
    {"name": "Hong Kong", "country": "China", "lat": 22.3193, "lng": 114.1694},
]
