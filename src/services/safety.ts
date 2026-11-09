/**
 * Rota güvenlik ve virajlılık analizi.
 *
 * Motosiklet kazalarında öne çıkan risk etkenlerinden rota geometrisi ve trafikten
 * çıkarılabilenleri puanlar:
 *  - Yüksek hızda keskin virajlar
 *  - Yoğun trafikte uzun şerit arası sürüş
 *  - Yüksek hızlı yol oranı (ağır vasıta, rüzgar)
 *  - Yağmur, gece, kuvvetli rüzgar
 */
import type { MotoSegment, RideConditions, SafetyReport } from '../types';
import { bearing, bearingDelta, haversine } from '../utils/geo';

const SHARP_TURN_DEG = 60;

export function analyzeSafety(segments: MotoSegment[], conditions: RideConditions): SafetyReport {
  let totalM = 0, filteringM = 0, highSpeedM = 0, sharpTurns = 0, ruralM = 0, ruralTurnDeg = 0;

  for (const seg of segments) {
    totalM += seg.distanceM;
    const speedKmh = seg.freeFlowS > 0 ? (seg.distanceM / seg.freeFlowS) * 3.6 : 0;
    if (seg.congestion !== 'free') filteringM += seg.distanceM;
    if (speedKmh >= 90) highSpeedM += seg.distanceM;
    const rural = seg.roadClass !== 'urban' && seg.roadClass !== 'local';

    // Geometriden yön değişimlerini çıkar (çok kısa parçaları yumuşatmak için ≥25 m adım)
    let prevBearing: number | null = null;
    let anchor = seg.coords[0];
    for (let i = 1; i < seg.coords.length; i++) {
      const p = seg.coords[i];
      if (haversine(anchor, p) < 25) continue;
      const b = bearing(anchor, p);
      if (prevBearing !== null) {
        const d = bearingDelta(prevBearing, b);
        if (d >= SHARP_TURN_DEG && speedKmh >= 60) sharpTurns++;
        if (rural) ruralTurnDeg += d;
      }
      prevBearing = b;
      anchor = p;
    }
    if (rural) ruralM += seg.distanceM;
  }

  const km = Math.max(totalM / 1000, 0.001);
  const sharpTurnsPerKm = sharpTurns / km;
  const filteringShare = totalM > 0 ? filteringM / totalM : 0;
  const highSpeedShare = totalM > 0 ? highSpeedM / totalM : 0;
  const curvinessDegPerKm = ruralM > 0 ? ruralTurnDeg / (ruralM / 1000) : 0;

  const warnings: string[] = [];
  let score = 100;
  score -= Math.min(25, sharpTurnsPerKm * 12);
  score -= filteringShare * 20;
  score -= highSpeedShare * 10;
  if (conditions.rain) {
    score -= 15;
    warnings.push('Yağmur: fren mesafesi uzar, yol çizgileri ve rögar kapaklarına dikkat.');
  }
  if (conditions.night) {
    score -= 8;
    warnings.push('Gece sürüşü: görünür ekipman (reflektör) kullanın.');
  }
  if ((conditions.windKmh ?? 0) >= 40) {
    score -= 10;
    warnings.push(`Kuvvetli rüzgar (${Math.round(conditions.windKmh!)} km/s): köprü ve viyadüklerde dikkat.`);
  }
  if (filteringShare > 0.3) warnings.push('Rotanın önemli bölümü yoğun trafikte; şerit arasında düşük hızda kalın.');
  if (sharpTurnsPerKm > 0.5) warnings.push('Hızlı yolda keskin virajlar var.');

  return {
    score: Math.round(Math.max(0, Math.min(100, score))),
    sharpTurnsPerKm,
    filteringShare,
    highSpeedShare,
    curvinessDegPerKm,
    warnings,
  };
}
