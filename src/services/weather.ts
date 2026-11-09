/** Anlık hava durumu — Open-Meteo (ücretsiz, anahtar gerektirmez). */
import type { LatLng, RideConditions } from '../types';

export interface Weather extends RideConditions {
  temperatureC: number;
  precipitationMm: number;
}

export async function fetchWeather(p: LatLng, signal?: AbortSignal): Promise<Weather> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}` +
    `&current=temperature_2m,precipitation,is_day,wind_speed_10m&wind_speed_unit=kmh`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Hava durumu alınamadı (${res.status})`);
  const json = (await res.json()) as {
    current: { temperature_2m: number; precipitation: number; is_day: number; wind_speed_10m: number };
  };
  const c = json.current;
  return {
    temperatureC: c.temperature_2m,
    precipitationMm: c.precipitation,
    rain: c.precipitation >= 0.2,
    night: c.is_day === 0,
    windKmh: c.wind_speed_10m,
  };
}

/** Hava bilgisi olmadan: yalnızca gece/gündüz (yaklaşık). */
export function basicConditions(now = new Date()): RideConditions {
  const h = now.getHours();
  return { rain: false, night: h < 6 || h >= 20 };
}
