/**
 * Uygulama yapılandırması. Değerler .env dosyasından (EXPO_PUBLIC_*) okunur.
 * Bkz. .env.example
 */
export const config = {
  /** Google Routes API anahtarı: canlı trafik (Moto+). Boşsa tahmini trafik modeli kullanılır. */
  googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '',
  /** OSRM sunucusu. Üretimde Türkiye OSM verisiyle kendi sunucunuzu kurun. */
  osrmUrl: process.env.EXPO_PUBLIC_OSRM_URL ?? 'https://router.project-osrm.org',
  /** Overpass API (OpenStreetMap POI). İlk yanıt vermezse sıradaki denenir. */
  overpassUrls: (process.env.EXPO_PUBLIC_OVERPASS_URLS ??
    'https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter')
    .split(',')
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0) as string[],
  nominatimUrl: process.env.EXPO_PUBLIC_NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org',
  userAgent: 'MotoRota/1.0 (motosiklet harita uygulamasi)',
};

export const hasLiveTraffic = () => config.googleMapsApiKey.length > 0;
