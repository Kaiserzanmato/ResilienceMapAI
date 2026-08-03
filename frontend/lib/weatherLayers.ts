/** OpenWeatherMap free-tier map layers (https://openweathermap.org/api/weather-map-2).
 * Tile keys match OWM's `/map/{layer}/{z}/{x}/{y}.png` path exactly. */
export const WEATHER_LAYERS = [
  { key: "precipitation_new", label: "Precipitation" },
  { key: "clouds_new", label: "Clouds" },
  { key: "wind_new", label: "Wind" },
  { key: "temp_new", label: "Temperature" },
  { key: "pressure_new", label: "Pressure" },
] as const;

export type WeatherLayerKey = (typeof WEATHER_LAYERS)[number]["key"];
export const WEATHER_LAYER_KEYS: string[] = WEATHER_LAYERS.map((l) => l.key);

/** Approximate color-scale ranges for each layer, matching OpenWeatherMap's
 * own published legend on openweathermap.org/weathermap — not pixel-exact
 * to this tile tier's internal color function, but the standard reference
 * range for each measurement type, which is what a legend is for. */
export const WEATHER_LEGENDS: Record<
  WeatherLayerKey,
  { min: string; max: string; gradient: string }
> = {
  temp_new: {
    min: "-70°C",
    max: "50°C",
    gradient: "linear-gradient(to right, #2166ac, #67a9cf, #67c98f, #f5e34c, #f2a541, #d7301f)",
  },
  wind_new: {
    min: "0 m/s",
    max: "29 m/s",
    gradient: "linear-gradient(to right, #2166ac, #67a9cf, #67c98f, #f5e34c, #f2a541, #b2182b)",
  },
  precipitation_new: {
    min: "0 mm/h",
    max: "40 mm/h",
    gradient: "linear-gradient(to right, #bcd9e8, #67c98f, #f5e34c, #f2a541, #d7301f, #7a1d8c)",
  },
  pressure_new: {
    min: "900 hPa",
    max: "1040 hPa",
    gradient: "linear-gradient(to right, #2166ac, #a6bddb, #f5e6c8, #f2a541, #b2182b)",
  },
  clouds_new: {
    min: "0%",
    max: "100%",
    gradient: "linear-gradient(to right, transparent, #94a3b8, #f1f5f9)",
  },
};
