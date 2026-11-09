import type { MotoRoute, RouteMode } from '../../types';

/**
 * fastest: en kısa motor süresi
 * safe: en hızlıdan en fazla %25 uzun rotalar içinde en yüksek güvenlik puanı
 * curvy: en hızlıdan en fazla %60 uzun rotalar içinde en virajlı (keyif rotası)
 */
export function rankRoutes(routes: MotoRoute[], mode: RouteMode): MotoRoute[] {
  if (routes.length <= 1) return routes;
  const fastest = Math.min(...routes.map((r) => r.motoS));
  const byTime = [...routes].sort((a, b) => a.motoS - b.motoS);
  if (mode === 'fastest') return byTime;
  if (mode === 'safe') {
    const ok = byTime.filter((r) => r.motoS <= fastest * 1.25);
    const rest = byTime.filter((r) => r.motoS > fastest * 1.25);
    return [...ok.sort((a, b) => b.safety.score - a.safety.score || a.motoS - b.motoS), ...rest];
  }
  const ok = byTime.filter((r) => r.motoS <= fastest * 1.6);
  const rest = byTime.filter((r) => r.motoS > fastest * 1.6);
  return [...ok.sort((a, b) => b.safety.curvinessDegPerKm - a.safety.curvinessDegPerKm), ...rest];
}
