import type { LatLng } from '../types';

const R = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function haversine(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(toRad(b.longitude - a.longitude)) * Math.cos(toRad(b.latitude));
  const x =
    Math.cos(toRad(a.latitude)) * Math.sin(toRad(b.latitude)) -
    Math.sin(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.cos(toRad(b.longitude - a.longitude));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** İki yön arasındaki en küçük açı farkı (0-180). */
export function bearingDelta(b1: number, b2: number): number {
  const d = Math.abs(b1 - b2) % 360;
  return d > 180 ? 360 - d : d;
}

export function pathLength(coords: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < coords.length; i++) sum += haversine(coords[i - 1], coords[i]);
  return sum;
}

/** Türkiye sınırlarını kapsayan yaklaşık kutu. */
export const TURKEY_BOUNDS = { minLat: 35.8, maxLat: 42.2, minLon: 25.6, maxLon: 44.9 };

export function isInTurkey(p: LatLng): boolean {
  return (
    p.latitude >= TURKEY_BOUNDS.minLat &&
    p.latitude <= TURKEY_BOUNDS.maxLat &&
    p.longitude >= TURKEY_BOUNDS.minLon &&
    p.longitude <= TURKEY_BOUNDS.maxLon
  );
}

export const TURKEY_REGION = {
  latitude: 39.0,
  longitude: 35.2,
  latitudeDelta: 9,
  longitudeDelta: 18,
};

export function regionForCoords(coords: LatLng[], padding = 1.3) {
  let minLat = Infinity, maxLat = -Infinity, minLon = Infinity, maxLon = -Infinity;
  for (const c of coords) {
    minLat = Math.min(minLat, c.latitude);
    maxLat = Math.max(maxLat, c.latitude);
    minLon = Math.min(minLon, c.longitude);
    maxLon = Math.max(maxLon, c.longitude);
  }
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.01, (maxLat - minLat) * padding),
    longitudeDelta: Math.max(0.01, (maxLon - minLon) * padding),
  };
}
