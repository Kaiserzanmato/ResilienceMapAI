import type { StyleSpecification } from "maplibre-gl";

/** Raster basemaps for each map view. CARTO now requires a public basemap key
 * on its raster tiles; non-CARTO providers below remain keyless. */

const CARTO_BASEMAP_API_KEY = process.env.NEXT_PUBLIC_CARTO_BASEMAP_API_KEY ?? "";

function withCartoKey(url: string): string {
  if (!CARTO_BASEMAP_API_KEY) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}key=${encodeURIComponent(CARTO_BASEMAP_API_KEY)}`;
}

function rasterStyle(
  id: string,
  tiles: string[],
  attribution: string,
  maxzoom = 19,
  extraLayers: { id: string; tiles: string[]; attribution?: string }[] = []
): StyleSpecification {
  const sources: StyleSpecification["sources"] = {
    [id]: { type: "raster", tiles, tileSize: 256, attribution, maxzoom },
  };
  const layers: StyleSpecification["layers"] = [
    { id: `${id}-layer`, type: "raster", source: id },
  ];
  for (const extra of extraLayers) {
    sources[extra.id] = {
      type: "raster",
      tiles: extra.tiles,
      tileSize: 256,
      attribution: extra.attribution ?? "",
      maxzoom,
    };
    layers.push({ id: `${extra.id}-layer`, type: "raster", source: extra.id });
  }
  return { version: 8, sources, layers };
}

const OSM_ATTR = "© OpenStreetMap contributors";
const CARTO_ATTR = "© OpenStreetMap contributors © CARTO";
const ESRI_ATTR = "© Esri, Maxar, Earthstar Geographics";

export const MAP_VIEWS: { key: string; label: string; style: StyleSpecification }[] = [
  {
    key: "standard",
    label: "Standard",
    style: rasterStyle("osm", ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], OSM_ATTR),
  },
  {
    key: "satellite",
    label: "Satellite",
    style: rasterStyle(
      "esri-sat",
      ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      ESRI_ATTR
    ),
  },
  {
    key: "terrain",
    label: "Terrain",
    style: rasterStyle(
      "otm",
      ["https://a.tile.opentopomap.org/{z}/{x}/{y}.png", "https://b.tile.opentopomap.org/{z}/{x}/{y}.png"],
      "© OpenTopoMap (CC-BY-SA)",
      16
    ),
  },
  {
    key: "hybrid",
    label: "Hybrid",
    style: rasterStyle(
      "esri-sat-h",
      ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      ESRI_ATTR,
      19,
      [
        {
          id: "carto-labels",
          tiles: [
            withCartoKey(
              "https://a.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png".replace("{r}", "")
            ),
            withCartoKey("https://b.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}.png"),
          ],
          attribution: CARTO_ATTR,
        },
      ]
    ),
  },
  {
    key: "dark",
    label: "Dark",
    style: rasterStyle(
      "carto-dark",
      [
        withCartoKey("https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"),
        withCartoKey("https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"),
        withCartoKey("https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"),
      ],
      CARTO_ATTR
    ),
  },
  {
    key: "light",
    label: "Light",
    style: rasterStyle(
      "carto-light",
      [
        withCartoKey("https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"),
        withCartoKey("https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"),
        withCartoKey("https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png"),
      ],
      CARTO_ATTR
    ),
  },
];

export function getMapStyle(key: string): StyleSpecification {
  return (MAP_VIEWS.find((v) => v.key === key) ?? MAP_VIEWS[4]).style;
}
