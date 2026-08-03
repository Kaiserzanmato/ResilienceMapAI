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
