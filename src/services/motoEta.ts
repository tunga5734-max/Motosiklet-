/**
 * MOTOSİKLET VARIŞ SÜRESİ MOTORU
 *
 * Harita servisleri (Google vb.) otomobil için iki süre üretir:
 *   - serbest akış süresi (trafik yokken)
 *   - trafikli süre
 * Aradaki fark trafik gecikmesidir. Otomobil bu gecikmenin tamamını yaşar; motosiklet ise
 * duran/yavaşlayan araçların arasından ilerlediği için gecikmenin büyük kısmından kurtulur.
 *
 * Her rota parçası için:
 *   gecikme      = trafikli - serbest
 *   kazanım (e)  = tıkanıklık × yol tipi × sürücü profili × hava koşulu katsayıları (0..0.85)
 *   motor süresi = serbest + gecikme × (1 - e)
 * Ardından fiziksel sınırlar uygulanır:
 *   - Tıkanıklıkta motor hızı ≤ max(şerit arası hız, araç hızı + fark) (ör. normal: 30 km/s, +25 km/s)
 *   - Motor hiçbir zaman serbest akıştan hızlı, trafikli otomobilden yavaş hesaplanmaz
 *   - 50cc altı motorlar 45 km/s ile sınırlıdır
 * Sinyalize kavşak gecikmesi (kırmızı ışık) şerit arasından aşılamayacağından şehir içi
 * yollarda katsayı düşüktür.
 */
import type {
  CarRoute,
  CongestionLevel,
  FilteringLevel,
  MotoRoute,
  MotoSegment,
  RiderProfile,
  RideConditions,
  RoadClass,
  RouteSegment,
} from '../types';
import { analyzeSafety } from './safety';

export const DEFAULT_PROFILE: RiderProfile = {
  filtering: 'normal',
  useShoulder: false,
  engineCc: 250,
};

export const DEFAULT_CONDITIONS: RideConditions = { rain: false, night: false };

/** Trafikli/serbest süre oranından tıkanıklık seviyesi. */
export function congestionOf(seg: Pick<RouteSegment, 'freeFlowS' | 'trafficS'>): CongestionLevel {
  if (seg.freeFlowS <= 0) return 'free';
  const r = seg.trafficS / seg.freeFlowS;
  if (r >= 1.6) return 'jam';
  if (r >= 1.15) return 'slow';
  return 'free';
}

const CONGESTION_GAIN: Record<CongestionLevel, number> = { free: 0, slow: 0.5, jam: 0.72 };

const ROAD_GAIN: Record<RoadClass, number> = {
  motorway: 1.0, // geniş şeritler
  trunk: 0.95,
  primary: 0.85,
  urban: 0.7, // kırmızı ışık gecikmesi aşılamaz
  local: 0.45, // dar yol, şerit arası zor
};

const PROFILE_GAIN: Record<FilteringLevel, number> = {
  none: 0,
  cautious: 0.6,
  normal: 1,
  experienced: 1.15,
};

/** Araçlar neredeyse dururken şerit arası ilerleme hızı (km/s). */
const FILTER_SPEED_KMH: Record<FilteringLevel, number> = {
  none: 0,
  cautious: 20,
  normal: 30,
  experienced: 40,
};

/** Yavaş akan trafikte motorun araç akışına göre hız farkı üst sınırı (km/s). */
const FILTER_DELTA_KMH: Record<FilteringLevel, number> = {
  none: 0,
  cautious: 12,
  normal: 25,
  experienced: 35,
};

const MAX_GAIN = 0.85;

export function filteringEfficiency(
  roadClass: RoadClass,
  congestion: CongestionLevel,
  profile: RiderProfile,
  conditions: RideConditions,
): number {
  let e = CONGESTION_GAIN[congestion] * ROAD_GAIN[roadClass] * PROFILE_GAIN[profile.filtering];
  if (e === 0) return 0;
  if (profile.useShoulder && (roadClass === 'motorway' || roadClass === 'trunk')) e += 0.1;
  if (conditions.rain) e *= 0.6; // ıslak zemin, düşük görüş
  if (conditions.night) e *= 0.9;
  if ((conditions.windKmh ?? 0) >= 50) e *= 0.85;
  return Math.max(0, Math.min(MAX_GAIN, e));
}

export function motoSegmentDuration(
  seg: RouteSegment,
  profile: RiderProfile,
  conditions: RideConditions,
): MotoSegment {
  const congestion = congestionOf(seg);
  const delay = Math.max(0, seg.trafficS - seg.freeFlowS);
  const e = filteringEfficiency(seg.roadClass, congestion, profile, conditions);
  let motoS = seg.freeFlowS + delay * (1 - e);

  // Tıkanıklıkta motor, araç akışından ancak belirli bir hız farkıyla ilerleyebilir:
  // v_motor ≤ max(şerit arası hız, araç hızı + fark)
  if (congestion === 'jam' && e > 0 && seg.trafficS > 0) {
    const carKmh = (seg.distanceM / seg.trafficS) * 3.6;
    const maxKmh = Math.max(FILTER_SPEED_KMH[profile.filtering], carKmh + FILTER_DELTA_KMH[profile.filtering]);
    motoS = Math.max(motoS, seg.distanceM / (maxKmh / 3.6));
  }

  // Yağmurda serbest akışta da biraz daha yavaş sürülür.
  const freeFlowMoto = seg.freeFlowS * (conditions.rain ? 1.08 : 1);
  motoS = Math.max(freeFlowMoto, Math.min(motoS, Math.max(seg.trafficS, freeFlowMoto)));

  // Moped (≤50cc) hız sınırı
  if (profile.engineCc <= 50) motoS = Math.max(motoS, seg.distanceM / (45 / 3.6));

  return { ...seg, motoS, congestion };
}

export function computeMotoRoute(
  route: CarRoute,
  profile: RiderProfile = DEFAULT_PROFILE,
  conditions: RideConditions = DEFAULT_CONDITIONS,
  /** Güvenlik uyarıları için koşullar (varsayılan: ETA koşulları) */
  safetyConditions: RideConditions = conditions,
): MotoRoute {
  const segments = route.segments.map((s) => motoSegmentDuration(s, profile, conditions));
  const motoS = segments.reduce((a, s) => a + s.motoS, 0);
  const carS = route.trafficS;
  return {
    route,
    motoS,
    carS,
    savedS: Math.max(0, carS - motoS),
    segments,
    safety: analyzeSafety(segments, safetyConditions),
  };
}

/** Serbest akış hızından yol sınıfı tahmini. */
export function roadClassFromSpeed(kmh: number): RoadClass {
  if (kmh >= 95) return 'motorway';
  if (kmh >= 75) return 'trunk';
  if (kmh >= 50) return 'primary';
  if (kmh >= 28) return 'urban';
  return 'local';
}
