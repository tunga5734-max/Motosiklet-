/**
 * Google Routes API (computeRoutes) — CANLI trafik.
 *
 * Google, otomobil için toplam trafikli süre (duration), trafiksiz süre (staticDuration) ve
 * polyline üzerinde hız bantları (NORMAL / SLOW / TRAFFIC_JAM) döner. Toplam gecikmeyi bu
 * bantlara ağırlıklı dağıtarak parça bazında trafikli süre elde ediyoruz; motor ETA motoru da
 * bu parçalar üzerinde çalışıyor.
 */
import { config } from '../../config';
import type { CarRoute, LatLng, RouteSegment, RouteStep } from '../../types';
import { haversine } from '../../utils/geo';
import { decodePolyline } from '../../utils/polyline';
import { roadClassFromSpeed } from '../motoEta';
import type { RouteRequest, RoutingProvider } from './types';

type Speed = 'NORMAL' | 'SLOW' | 'TRAFFIC_JAM' | 'SPEED_UNSPECIFIED';

interface GInterval {
  startPolylinePointIndex?: number;
  endPolylinePointIndex?: number;
  speed?: Speed;
}
interface GStep {
  distanceMeters?: number;
  staticDuration?: string;
  navigationInstruction?: { instructions?: string };
  startLocation?: { latLng: LatLng };
}
export interface GRoute {
  distanceMeters: number;
  duration: string;
  staticDuration: string;
  description?: string;
  polyline: { encodedPolyline: string };
  travelAdvisory?: { speedReadingIntervals?: GInterval[] };
  legs?: { steps?: GStep[] }[];
}

const parseSeconds = (s?: string) => (s ? parseFloat(s.replace('s', '')) || 0 : 0);

/** Gecikmenin dağıtımında hız bandı ağırlıkları. */
const DELAY_WEIGHT: Record<Speed, number> = {
  NORMAL: 0.08,
  SPEED_UNSPECIFIED: 0.08,
  SLOW: 1,
  TRAFFIC_JAM: 3,
};

const SEGMENT_TARGET_M = 500;

export function segmentsFromGoogleRoute(route: GRoute, polyline: LatLng[]): RouteSegment[] {
  const n = polyline.length;
  if (n < 2) return [];
  const totalStatic = parseSeconds(route.staticDuration);
  const totalTraffic = Math.max(parseSeconds(route.duration), totalStatic);

  // Kenar uzunlukları
  const edgeLen: number[] = [];
  let polyLen = 0;
  for (let i = 0; i < n - 1; i++) {
    const d = haversine(polyline[i], polyline[i + 1]);
    edgeLen.push(d);
    polyLen += d;
  }

  // Adım (step) hızları → kenar başına serbest akış süresi
  const steps = route.legs?.flatMap((l) => l.steps ?? []) ?? [];
  const stepBounds: { end: number; speed: number }[] = [];
  let acc = 0;
  const avgSpeed = polyLen / Math.max(totalStatic, 1);
  for (const s of steps) {
    const dist = s.distanceMeters ?? 0;
    const t = parseSeconds(s.staticDuration);
    acc += dist;
    stepBounds.push({ end: acc, speed: dist > 0 && t > 0 ? dist / t : avgSpeed });
  }
  const scale = acc > 0 ? polyLen / acc : 1;

  // Kenar başına hız bandı
  const edgeSpeed: Speed[] = new Array(n - 1).fill('NORMAL');
  for (const iv of route.travelAdvisory?.speedReadingIntervals ?? []) {
    const a = iv.startPolylinePointIndex ?? 0;
    const b = Math.min(iv.endPolylinePointIndex ?? n - 1, n - 1);
    for (let i = a; i < b; i++) edgeSpeed[i] = iv.speed ?? 'NORMAL';
  }

  const edgeFree: number[] = [];
  let cum = 0, si = 0;
  for (let i = 0; i < n - 1; i++) {
    const mid = (cum + edgeLen[i] / 2) / scale;
    while (si < stepBounds.length - 1 && stepBounds[si].end < mid) si++;
    const v = stepBounds.length ? stepBounds[si].speed : avgSpeed;
    edgeFree.push(edgeLen[i] / Math.max(v, 0.5));
    cum += edgeLen[i];
  }
  // Serbest akış toplamını Google'ın staticDuration değerine normalize et
  const freeSum = edgeFree.reduce((a, b) => a + b, 0);
  const freeScale = freeSum > 0 && totalStatic > 0 ? totalStatic / freeSum : 1;

  // Parçalara grupla (hız bandı değişince veya ~500 m'de kes)
  const groups: { seg: RouteSegment; speed: Speed }[] = [];
  let cur: { seg: RouteSegment; speed: Speed } | null = null;
  for (let i = 0; i < n - 1; i++) {
    if (!cur || cur.speed !== edgeSpeed[i] || cur.seg.distanceM >= SEGMENT_TARGET_M) {
      if (cur) groups.push(cur);
      cur = {
        speed: edgeSpeed[i],
        seg: { coords: [polyline[i]], distanceM: 0, freeFlowS: 0, trafficS: 0, roadClass: 'primary' },
      };
    }
    cur.seg.coords.push(polyline[i + 1]);
    cur.seg.distanceM += edgeLen[i];
    cur.seg.freeFlowS += edgeFree[i] * freeScale;
  }
  if (cur) groups.push(cur);

  // Toplam gecikmeyi ağırlıklı dağıt
  const delay = totalTraffic - totalStatic;
  const weightSum = groups.reduce((a, g) => a + DELAY_WEIGHT[g.speed] * g.seg.freeFlowS, 0);
  for (const g of groups) {
    const share = weightSum > 0 ? (DELAY_WEIGHT[g.speed] * g.seg.freeFlowS) / weightSum : 0;
    g.seg.trafficS = g.seg.freeFlowS + delay * share;
    g.seg.roadClass = roadClassFromSpeed((g.seg.distanceM / Math.max(g.seg.freeFlowS, 0.01)) * 3.6);
  }
  return groups.map((g) => g.seg);
}

export const googleProvider: RoutingProvider = {
  name: 'Google (canlı trafik)',
  async getRoutes(req: RouteRequest, signal?: AbortSignal): Promise<CarRoute[]> {
    const body = {
      origin: { location: { latLng: req.origin } },
      destination: { location: { latLng: req.destination } },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE_OPTIMAL',
      extraComputations: ['TRAFFIC_ON_POLYLINE'],
      computeAlternativeRoutes: req.alternatives,
      routeModifiers: { avoidHighways: req.avoidHighways, avoidTolls: req.avoidTolls },
      languageCode: 'tr-TR',
      regionCode: 'TR',
      units: 'METRIC',
    };
    const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googleMapsApiKey,
        'X-Goog-FieldMask': [
          'routes.distanceMeters',
          'routes.duration',
          'routes.staticDuration',
          'routes.description',
          'routes.polyline.encodedPolyline',
          'routes.travelAdvisory.speedReadingIntervals',
          'routes.legs.steps.distanceMeters',
          'routes.legs.steps.staticDuration',
          'routes.legs.steps.navigationInstruction.instructions',
          'routes.legs.steps.startLocation',
        ].join(','),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Google Routes hatası (${res.status})`);
    const json = (await res.json()) as { routes?: GRoute[] };
    if (!json.routes?.length) throw new Error('Rota bulunamadı');

    return json.routes.map((r, idx): CarRoute => {
      const polyline = decodePolyline(r.polyline.encodedPolyline);
      const segments = segmentsFromGoogleRoute(r, polyline);
      const steps: RouteStep[] = (r.legs ?? []).flatMap((l) =>
        (l.steps ?? []).map((s) => ({
          instruction: s.navigationInstruction?.instructions ?? 'Devam edin',
          distanceM: s.distanceMeters ?? 0,
          location: s.startLocation?.latLng ?? polyline[0],
        })),
      );
      return {
        id: `google-${idx}`,
        provider: 'google',
        summary: r.description || `Rota ${idx + 1}`,
        distanceM: r.distanceMeters,
        freeFlowS: parseSeconds(r.staticDuration),
        trafficS: Math.max(parseSeconds(r.duration), parseSeconds(r.staticDuration)),
        polyline,
        segments,
        steps,
        trafficSource: 'live',
      };
    });
  },
};
