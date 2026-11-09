/** Sürüş sırasında ilerleme takibi: kalan süre, sıradaki manevra, rotadan çıkma. */
import type { LatLng, MotoRoute, RouteStep } from '../types';
import { haversine } from '../utils/geo';

export interface NavProgress {
  remainingMotoS: number;
  remainingM: number;
  nextStep: RouteStep | null;
  distanceToNextStepM: number;
  offRouteM: number;
  arrived: boolean;
}

interface Indexed {
  /** Her parçanın rota başından itibaren başlangıç mesafesi */
  segStart: number[];
  /** Adımların rota üzerindeki yaklaşık konumu (m) */
  stepAt: number[];
}

const cache = new WeakMap<MotoRoute, Indexed>();

function index(route: MotoRoute): Indexed {
  const hit = cache.get(route);
  if (hit) return hit;
  const segStart: number[] = [];
  let acc = 0;
  for (const s of route.segments) {
    segStart.push(acc);
    acc += s.distanceM;
  }
  const stepAt = route.route.steps.map((st) => locate(route, segStart, st.location).along);
  const idx = { segStart, stepAt };
  cache.set(route, idx);
  return idx;
}

function locate(route: MotoRoute, segStart: number[], p: LatLng) {
  let best = { dist: Infinity, seg: 0, along: 0, frac: 0 };
  route.segments.forEach((s, si) => {
    let walked = 0;
    for (let i = 0; i < s.coords.length; i++) {
      if (i > 0) walked += haversine(s.coords[i - 1], s.coords[i]);
      const d = haversine(p, s.coords[i]);
      if (d < best.dist) {
        const frac = s.distanceM > 0 ? Math.min(1, walked / s.distanceM) : 0;
        best = { dist: d, seg: si, along: segStart[si] + walked, frac };
      }
    }
  });
  return best;
}

export function navProgress(route: MotoRoute, position: LatLng): NavProgress {
  const { segStart, stepAt } = index(route);
  const loc = locate(route, segStart, position);
  let remainingMotoS = route.segments[loc.seg] ? route.segments[loc.seg].motoS * (1 - loc.frac) : 0;
  for (let i = loc.seg + 1; i < route.segments.length; i++) remainingMotoS += route.segments[i].motoS;
  const remainingM = Math.max(0, route.route.distanceM - loc.along);

  const nextIdx = stepAt.findIndex((a) => a > loc.along + 15);
  const nextStep = nextIdx >= 0 ? route.route.steps[nextIdx] : null;
  return {
    remainingMotoS,
    remainingM,
    nextStep,
    distanceToNextStepM: nextIdx >= 0 ? stepAt[nextIdx] - loc.along : remainingM,
    offRouteM: loc.dist,
    arrived: remainingM < 40,
  };
}
