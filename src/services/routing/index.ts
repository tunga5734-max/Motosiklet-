import type { MotoRoute, RiderProfile, RideConditions, RouteMode } from '../../types';
import { hasLiveTraffic } from '../../config';
import { isInTurkey } from '../../utils/geo';
import { computeMotoRoute } from '../motoEta';
import { googleProvider } from './google';
import { osrmProvider } from './osrm';
import { rankRoutes } from './rank';
import type { RouteRequest } from './types';

export { rankRoutes };

export interface PlanOptions {
  profile: RiderProfile;
  conditions: RideConditions;
  /** Güvenlik uyarılarında kullanılacak gerçek hava koşulları */
  safetyConditions?: RideConditions;
  mode: RouteMode;
  /** Moto+ üyelerde ve API anahtarı varsa canlı trafik kullanılır */
  liveTraffic: boolean;
  alternatives: boolean;
  avoidTolls: boolean;
}

export interface PlanResult {
  routes: MotoRoute[];
  providerName: string;
  notice?: string;
}

export async function planRoutes(
  req: Omit<RouteRequest, 'alternatives' | 'avoidHighways' | 'avoidTolls'>,
  opts: PlanOptions,
  signal?: AbortSignal,
): Promise<PlanResult> {
  if (!isInTurkey(req.origin) || !isInTurkey(req.destination)) {
    throw new Error('MotoRota şu an yalnızca Türkiye içindeki rotaları destekliyor.');
  }
  const fullReq: RouteRequest = {
    ...req,
    alternatives: opts.alternatives || opts.mode !== 'fastest',
    // 50cc ve altı motosikletler otoyola giremez
    avoidHighways: opts.profile.engineCc <= 50,
    avoidTolls: opts.avoidTolls,
  };

  let notice: string | undefined;
  let provider = osrmProvider;
  if (opts.liveTraffic && hasLiveTraffic()) provider = googleProvider;
  else if (opts.liveTraffic) notice = 'Canlı trafik anahtarı tanımlı değil; tahmini trafik kullanılıyor.';

  let carRoutes;
  try {
    carRoutes = await provider.getRoutes(fullReq, signal);
  } catch (e) {
    if (provider === osrmProvider) throw e;
    notice = 'Canlı trafik servisine ulaşılamadı; tahmini trafik kullanılıyor.';
    provider = osrmProvider;
    carRoutes = await provider.getRoutes(fullReq, signal);
  }

  const motoRoutes = carRoutes.map((r) => computeMotoRoute(r, opts.profile, opts.conditions, opts.safetyConditions ?? opts.conditions));
  const ranked = rankRoutes(motoRoutes, opts.mode);
  return {
    routes: opts.alternatives ? ranked : ranked.slice(0, 1),
    providerName: provider.name,
    notice,
  };
}
