/**
 * OSRM (OpenStreetMap) yönlendirme. Ücretsizdir, Türkiye'nin tamamını kapsar ancak canlı
 * trafik içermez; trafikli süre trafficModel ile tahmin edilir.
 */
import { config } from '../../config';
import type { CarRoute, LatLng, RouteSegment, RouteStep } from '../../types';
import { roadClassFromSpeed } from '../motoEta';
import { estimatedTrafficFactor } from '../trafficModel';
import type { RouteRequest, RoutingProvider } from './types';

interface OsrmStep {
  distance: number;
  name: string;
  maneuver: { type: string; modifier?: string; location: [number, number] };
}
interface OsrmRoute {
  distance: number;
  duration: number;
  geometry: { coordinates: [number, number][] };
  legs: { summary: string; steps: OsrmStep[]; annotation: { distance: number[]; duration: number[] } }[];
}

const MODIFIER_TR: Record<string, string> = {
  left: 'sola dönün',
  right: 'sağa dönün',
  'slight left': 'hafif sola dönün',
  'slight right': 'hafif sağa dönün',
  'sharp left': 'keskin sola dönün',
  'sharp right': 'keskin sağa dönün',
  straight: 'düz devam edin',
  uturn: 'U dönüşü yapın',
};

export function osrmInstruction(step: OsrmStep): string {
  const road = step.name ? ` (${step.name})` : '';
  const mod = step.maneuver.modifier ? MODIFIER_TR[step.maneuver.modifier] ?? '' : '';
  switch (step.maneuver.type) {
    case 'depart':
      return `Yola çıkın${road}`;
    case 'arrive':
      return 'Varış noktasına ulaştınız';
    case 'roundabout':
    case 'rotary':
      return `Göbekten çıkın${road}`;
    case 'merge':
      return `Trafiğe katılın${road}`;
    case 'on ramp':
      return `Bağlantı yoluna girin${road}`;
    case 'off ramp':
      return `Çıkışı kullanın${road}`;
    case 'fork':
      return `Ayrımda ${mod || 'devam edin'}${road}`;
    default:
      return `${mod ? mod[0].toUpperCase() + mod.slice(1) : 'Devam edin'}${road}`;
  }
}

const SEGMENT_TARGET_M = 400;

/** OSRM düğüm-arası anotasyonlarını ~400 m'lik, aynı yol sınıfındaki parçalara böler. */
export function buildSegments(
  coords: LatLng[],
  distances: number[],
  durations: number[],
  when: Date,
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  let cur: RouteSegment | null = null;
  for (let i = 0; i < distances.length; i++) {
    const d = distances[i];
    const t = Math.max(durations[i], 0.01);
    const cls = roadClassFromSpeed((d / t) * 3.6);
    if (!cur || cur.distanceM >= SEGMENT_TARGET_M || (cur.roadClass !== cls && cur.distanceM > 100)) {
      if (cur) segments.push(cur);
      cur = { coords: [coords[i]], distanceM: 0, freeFlowS: 0, trafficS: 0, roadClass: cls };
    }
    cur.coords.push(coords[i + 1]);
    cur.distanceM += d;
    cur.freeFlowS += t;
  }
  if (cur) segments.push(cur);
  for (const s of segments) {
    // Sınıfı parçanın ortalama hızına göre güncelle ve trafiği tahmin et
    s.roadClass = roadClassFromSpeed((s.distanceM / Math.max(s.freeFlowS, 0.01)) * 3.6);
    const mid = s.coords[Math.floor(s.coords.length / 2)];
    s.trafficS = s.freeFlowS * estimatedTrafficFactor(mid, s.roadClass, when);
  }
  return segments;
}

export const osrmProvider: RoutingProvider = {
  name: 'OpenStreetMap (OSRM)',
  async getRoutes(req: RouteRequest, signal?: AbortSignal): Promise<CarRoute[]> {
    const { origin: o, destination: d } = req;
    const exclude = [req.avoidHighways && 'motorway', req.avoidTolls && 'toll'].filter(Boolean).join(',');
    const url =
      `${config.osrmUrl}/route/v1/driving/${o.longitude},${o.latitude};${d.longitude},${d.latitude}` +
      `?overview=full&geometries=geojson&steps=true&annotations=distance,duration` +
      `&alternatives=${req.alternatives ? 'true' : 'false'}` +
      (exclude ? `&exclude=${exclude}` : '');
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`Rota servisi hatası (${res.status})`);
    const json = (await res.json()) as { code: string; message?: string; routes: OsrmRoute[] };
    if (json.code !== 'Ok') throw new Error(json.message || 'Rota bulunamadı');
    const when = req.departure ?? new Date();

    return json.routes.map((r, idx): CarRoute => {
      const polyline = r.geometry.coordinates.map(([lon, lat]) => ({ latitude: lat, longitude: lon }));
      const distances = r.legs.flatMap((l) => l.annotation.distance);
      const durations = r.legs.flatMap((l) => l.annotation.duration);
      const segments = buildSegments(polyline, distances, durations, when);
      const steps: RouteStep[] = r.legs.flatMap((l) =>
        l.steps.map((s) => ({
          instruction: osrmInstruction(s),
          distanceM: s.distance,
          location: { latitude: s.maneuver.location[1], longitude: s.maneuver.location[0] },
        })),
      );
      return {
        id: `osrm-${idx}`,
        provider: 'osrm',
        summary: r.legs.map((l) => l.summary).filter(Boolean).join(' / ') || `Rota ${idx + 1}`,
        distanceM: r.distance,
        freeFlowS: segments.reduce((a, s) => a + s.freeFlowS, 0),
        trafficS: segments.reduce((a, s) => a + s.trafficS, 0),
        polyline,
        segments,
        steps,
        trafficSource: 'estimated',
      };
    });
  },
};
