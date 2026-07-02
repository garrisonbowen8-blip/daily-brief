// Live weather via Open-Meteo — free, no API key. Location defaults to the
// San Francisco Bay Area; override with WEATHER_LAT / WEATHER_LON / WEATHER_PLACE
// in .env.local.

export const dynamic = "force-dynamic";

const CODES: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Fog", 48: "Rime fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Rain showers", 81: "Rain showers", 82: "Violent showers",
  85: "Snow showers", 86: "Snow showers", 95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
};

export async function GET() {
  const lat = process.env.WEATHER_LAT ?? "37.8716";
  const lon = process.env.WEATHER_LON ?? "-122.2727";
  const place = process.env.WEATHER_PLACE ?? "Berkeley, CA";

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
      `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
      `&daily=temperature_2m_max,temperature_2m_min&temperature_unit=fahrenheit&timezone=auto&forecast_days=1`;
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const d = await res.json();
    const cur = d.current ?? {};
    const daily = d.daily ?? {};
    return Response.json({
      connected: true,
      place,
      temp: Math.round(cur.temperature_2m ?? 0),
      code: cur.weather_code ?? 0,
      condition: CODES[cur.weather_code as number] ?? "—",
      wind: Math.round(cur.wind_speed_10m ?? 0),
      humidity: Math.round(cur.relative_humidity_2m ?? 0),
      hi: Math.round(daily.temperature_2m_max?.[0] ?? 0),
      lo: Math.round(daily.temperature_2m_min?.[0] ?? 0),
    });
  } catch (err) {
    return Response.json({
      connected: false,
      reason: err instanceof Error ? err.message : "weather fetch failed",
    });
  }
}
