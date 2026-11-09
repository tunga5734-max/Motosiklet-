/** Adres / yer arama — Nominatim (OpenStreetMap), Türkiye ile sınırlı. */
import { config } from '../config';
import type { LatLng, SearchResult } from '../types';

interface NominatimItem {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  name?: string;
}

export async function searchPlaces(query: string, near?: LatLng, signal?: AbortSignal): Promise<SearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    format: 'jsonv2',
    countrycodes: 'tr',
    'accept-language': 'tr',
    limit: '8',
  });
  if (near) {
    const d = 1.5; // yakın sonuçları öne çıkar (kısıtlamadan)
    params.set('viewbox', `${near.longitude - d},${near.latitude + d},${near.longitude + d},${near.latitude - d}`);
  }
  const res = await fetch(`${config.nominatimUrl}/search?${params}`, {
    signal,
    headers: { 'User-Agent': config.userAgent, 'Accept-Language': 'tr' },
  });
  if (!res.ok) throw new Error(`Arama hatası (${res.status})`);
  const items = (await res.json()) as NominatimItem[];
  return items.map((it) => {
    const parts = it.display_name.split(', ');
    return {
      id: String(it.place_id),
      title: it.name || parts[0],
      subtitle: parts.slice(1, 4).join(', '),
      location: { latitude: parseFloat(it.lat), longitude: parseFloat(it.lon) },
    };
  });
}
