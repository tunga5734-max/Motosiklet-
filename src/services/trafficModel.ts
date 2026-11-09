/**
 * Tahmini trafik modeli.
 *
 * Canlı trafik verisi (Google Routes API anahtarı) yoksa, OSRM'den gelen serbest akış
 * sürelerini Türkiye büyükşehirlerinin tipik trafik örüntüsüyle (saat, gün, yol tipi)
 * çarparak otomobil trafikli süresi tahmin edilir. Sonuç "tahmini" olarak etiketlenir.
 */
import type { LatLng, RoadClass } from '../types';
import { haversine } from '../utils/geo';

interface Metro {
  name: string;
  center: LatLng;
  radiusKm: number;
  /** Zirve saatte arter yollardaki tipik süre çarpanı */
  peak: number;
}

export const METROS: Metro[] = [
  { name: 'İstanbul', center: { latitude: 41.03, longitude: 28.98 }, radiusKm: 45, peak: 2.3 },
  { name: 'Ankara', center: { latitude: 39.93, longitude: 32.85 }, radiusKm: 25, peak: 1.7 },
  { name: 'İzmir', center: { latitude: 38.42, longitude: 27.14 }, radiusKm: 25, peak: 1.75 },
  { name: 'Bursa', center: { latitude: 40.19, longitude: 29.06 }, radiusKm: 18, peak: 1.6 },
  { name: 'Kocaeli', center: { latitude: 40.77, longitude: 29.92 }, radiusKm: 20, peak: 1.5 },
  { name: 'Antalya', center: { latitude: 36.9, longitude: 30.7 }, radiusKm: 18, peak: 1.5 },
  { name: 'Adana', center: { latitude: 37.0, longitude: 35.32 }, radiusKm: 15, peak: 1.45 },
  { name: 'Konya', center: { latitude: 37.87, longitude: 32.49 }, radiusKm: 15, peak: 1.35 },
  { name: 'Gaziantep', center: { latitude: 37.07, longitude: 37.38 }, radiusKm: 15, peak: 1.4 },
  { name: 'Kayseri', center: { latitude: 38.72, longitude: 35.49 }, radiusKm: 12, peak: 1.3 },
  { name: 'Mersin', center: { latitude: 36.8, longitude: 34.63 }, radiusKm: 15, peak: 1.35 },
  { name: 'Diyarbakır', center: { latitude: 37.91, longitude: 40.22 }, radiusKm: 12, peak: 1.3 },
  { name: 'Samsun', center: { latitude: 41.29, longitude: 36.33 }, radiusKm: 12, peak: 1.3 },
  { name: 'Eskişehir', center: { latitude: 39.78, longitude: 30.52 }, radiusKm: 12, peak: 1.3 },
];

/** 0..1 arası saat yoğunluk eğrisi (hafta içi). Sabah 08:00 ve akşam 18:00 zirve. */
function weekdayIntensity(hour: number): number {
  const g = (mu: number, sigma: number) => Math.exp(-((hour - mu) ** 2) / (2 * sigma ** 2));
  return Math.min(1, 0.95 * g(8.2, 1.1) + 1.0 * g(18.2, 1.5) + 0.35 * g(13, 2.5));
}

function weekendIntensity(hour: number): number {
  const g = (mu: number, sigma: number) => Math.exp(-((hour - mu) ** 2) / (2 * sigma ** 2));
  return 0.55 * g(15, 3.5);
}

const ROAD_SENSITIVITY: Record<RoadClass, number> = {
  motorway: 1.0, // çevre yolları/otoyol girişleri büyükşehirde çok tıkanır
  trunk: 1.0,
  primary: 0.9,
  urban: 0.75,
  local: 0.4,
};

export function metroAt(p: LatLng): Metro | null {
  let best: Metro | null = null;
  let bestRatio = Infinity;
  for (const m of METROS) {
    const ratio = haversine(p, m.center) / 1000 / m.radiusKm;
    if (ratio <= 1 && ratio < bestRatio) {
      best = m;
      bestRatio = ratio;
    }
  }
  return best;
}

/** Bir noktada, verilen zamanda, verilen yol sınıfı için tahmini trafik çarpanı (≥1). */
export function estimatedTrafficFactor(p: LatLng, roadClass: RoadClass, when: Date): number {
  const metro = metroAt(p);
  const day = when.getDay();
  const hour = when.getHours() + when.getMinutes() / 60;
  const intensity = day === 0 || day === 6 ? weekendIntensity(hour) : weekdayIntensity(hour);
  if (!metro) {
    // Şehirlerarası yollar: bayram/hafta sonu çıkışları hariç genelde akıcı
    return 1 + 0.08 * intensity * ROAD_SENSITIVITY[roadClass];
  }
  // Merkeze yakınlık tıkanıklığı artırır
  const distRatio = haversine(p, metro.center) / 1000 / metro.radiusKm;
  const centrality = 1 - 0.5 * distRatio;
  const baseline = 1.12; // yoğun şehirlerde gün boyu taban
  return baseline + (metro.peak - baseline) * intensity * centrality * ROAD_SENSITIVITY[roadClass];
}
