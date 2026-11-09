/**
 * Motosiklet dostu mekanlar — OpenStreetMap (Overpass API).
 * OSM verisi topluluk tarafından sürekli güncellenir ve Türkiye'nin tamamını kapsar.
 *
 * "Moto dostu" puanı:
 *  +3  motosiklet satış/servis (shop=motorcycle, motorcycle:repair vb.)
 *  +2  motosikletle ilgili etiket (motorcycle=yes/designated, motorcycle:* , motorcycle_friendly)
 *  +1  150 m içinde motosiklet parkı
 *  +1  7/24 açık akaryakıt
 *  +2  topluluk onayı (kullanıcı oyları)
 */
import { config } from '../config';
import type { LatLng, Place, PlaceCategory } from '../types';
import { haversine } from '../utils/geo';

interface OsmElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function buildOverpassQuery(center: LatLng, radiusM: number): string {
  const a = `around:${Math.round(radiusM)},${center.latitude},${center.longitude}`;
  return `[out:json][timeout:25];
(
  nwr(${a})[amenity=fuel];
  nwr(${a})[amenity~"^(cafe|restaurant|fast_food)$"];
  nwr(${a})[shop~"^(motorcycle|motorcycle_repair|tyres)$"];
  nwr(${a})[craft=motorcycle_repair];
  nwr(${a})[amenity=motorcycle_parking];
);
out center tags 400;`;
}

function categoryOf(tags: Record<string, string>): PlaceCategory | null {
  if (tags.amenity === 'fuel') return 'fuel';
  if (tags.amenity === 'motorcycle_parking') return 'parking';
  if (
    tags.shop === 'motorcycle' ||
    tags.shop === 'motorcycle_repair' ||
    tags.shop === 'tyres' ||
    tags.craft === 'motorcycle_repair'
  )
    return 'service';
  if (tags.amenity === 'cafe' || tags.amenity === 'restaurant' || tags.amenity === 'fast_food') return 'cafe';
  return null;
}

function hasMotoTag(tags: Record<string, string>): boolean {
  if (/motor|moto|biker/i.test(tags.name ?? '')) return true;
  return Object.entries(tags).some(
    ([k, v]) =>
      (k === 'motorcycle' && (v === 'yes' || v === 'designated')) ||
      (k.startsWith('motorcycle:') && v !== 'no') ||
      (k === 'motorcycle_friendly' && v !== 'no'),
  );
}

export function scorePlaces(elements: OsmElement[], votes: Record<string, number> = {}): Place[] {
  const raw: Place[] = [];
  for (const el of elements) {
    const tags = el.tags ?? {};
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;
    const category = categoryOf(tags);
    if (!category) continue;
    const id = `${el.type}/${el.id}`;
    const open24h = tags.opening_hours === '24/7';
    raw.push({
      id,
      name: tags.name || tags.brand || defaultName(category),
      category,
      location: { latitude: lat, longitude: lon },
      tags,
      motoScore: 0,
      motoFriendly: false,
      open24h,
    });
  }
  const parkings = raw.filter((p) => p.category === 'parking');
  for (const p of raw) {
    let s = 0;
    if (p.category === 'service') s += 3;
    if (hasMotoTag(p.tags)) s += 2;
    if (p.category !== 'parking' && parkings.some((k) => haversine(k.location, p.location) <= 150)) s += 1;
    if (p.category === 'fuel' && p.open24h) s += 1;
    if ((votes[p.id] ?? 0) > 0) s += 2;
    p.motoScore = s;
    p.motoFriendly = s >= 2 || p.category === 'parking';
  }
  return raw;
}

function defaultName(c: PlaceCategory): string {
  return { fuel: 'Akaryakıt istasyonu', cafe: 'Kafe', service: 'Motosiklet servisi', parking: 'Motosiklet parkı' }[c];
}

export async function fetchPlaces(
  center: LatLng,
  radiusM: number,
  votes: Record<string, number>,
  signal?: AbortSignal,
): Promise<Place[]> {
  const query = buildOverpassQuery(center, radiusM);
  let lastErr: unknown;
  for (const url of config.overpassUrls) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': config.userAgent },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) throw new Error(`Overpass ${res.status}`);
      const json = (await res.json()) as { elements: OsmElement[] };
      return scorePlaces(json.elements, votes)
        .map((p) => ({ ...p, distanceM: haversine(center, p.location) }))
        .sort((a, b) => a.distanceM! - b.distanceM!);
    } catch (e) {
      if (signal?.aborted) throw e;
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('Mekanlar yüklenemedi');
}
