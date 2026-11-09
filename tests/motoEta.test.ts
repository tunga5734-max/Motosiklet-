/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  computeMotoRoute,
  congestionOf,
  DEFAULT_PROFILE,
  motoSegmentDuration,
  roadClassFromSpeed,
} from '../src/services/motoEta';
import { rankRoutes } from '../src/services/routing/rank';
import type { CarRoute, LatLng, RouteSegment } from '../src/types';

const line = (n: number, start: LatLng = { latitude: 41, longitude: 29 }): LatLng[] =>
  Array.from({ length: n }, (_, i) => ({ latitude: start.latitude, longitude: start.longitude + i * 0.001 }));

function seg(distanceM: number, freeKmh: number, trafficFactor: number): RouteSegment {
  const freeFlowS = distanceM / (freeKmh / 3.6);
  return {
    coords: line(3),
    distanceM,
    freeFlowS,
    trafficS: freeFlowS * trafficFactor,
    roadClass: roadClassFromSpeed(freeKmh),
  };
}

function route(segments: RouteSegment[], id = 'r'): CarRoute {
  return {
    id,
    provider: 'osrm',
    summary: id,
    distanceM: segments.reduce((a, s) => a + s.distanceM, 0),
    freeFlowS: segments.reduce((a, s) => a + s.freeFlowS, 0),
    trafficS: segments.reduce((a, s) => a + s.trafficS, 0),
    polyline: segments.flatMap((s) => s.coords),
    segments,
    steps: [],
    trafficSource: 'estimated',
  };
}

const dry = { rain: false, night: false };

test('trafik yoksa motor ve araba süresi aynı', () => {
  const m = motoSegmentDuration(seg(1000, 90, 1.0), DEFAULT_PROFILE, dry);
  assert.equal(m.congestion, 'free');
  assert.ok(Math.abs(m.motoS - m.freeFlowS) < 1e-6);
});

test('yoğun trafikte motor belirgin şekilde daha hızlı ama serbest akıştan hızlı değil', () => {
  const s = seg(5000, 90, 3); // otoyolda 3 kat gecikme
  const m = motoSegmentDuration(s, DEFAULT_PROFILE, dry);
  assert.equal(m.congestion, 'jam');
  assert.ok(m.motoS < s.trafficS * 0.6, `moto ${m.motoS} car ${s.trafficS}`);
  assert.ok(m.motoS >= s.freeFlowS);
});

test('şerit arası sürüş hızı sınırı uygulanır', () => {
  // 1 km, serbest 100 km/s, araç 10x tıkalı. Normal profil ≤30 km/s → ≥120 sn
  const s = seg(1000, 100, 10);
  const m = motoSegmentDuration(s, DEFAULT_PROFILE, dry);
  assert.ok(m.motoS >= 120 - 1e-6, `motoS ${m.motoS}`);
  assert.ok(m.motoS <= s.trafficS);
});

test('şerit arası sürmeyen sürücü araba ile aynı süreyi alır', () => {
  const s = seg(3000, 60, 2);
  const m = motoSegmentDuration(s, { ...DEFAULT_PROFILE, filtering: 'none' }, dry);
  assert.ok(Math.abs(m.motoS - s.trafficS) < 1e-6);
});

test('yağmur kazanımı azaltır, deneyimli profil artırır', () => {
  const s = seg(4000, 70, 2.5);
  const normal = motoSegmentDuration(s, DEFAULT_PROFILE, dry).motoS;
  const rain = motoSegmentDuration(s, DEFAULT_PROFILE, { rain: true, night: false }).motoS;
  const exp = motoSegmentDuration(s, { ...DEFAULT_PROFILE, filtering: 'experienced' }, dry).motoS;
  assert.ok(rain > normal);
  assert.ok(exp <= normal);
});

test('moped 45 km/s ile sınırlı', () => {
  const s = seg(10000, 110, 1);
  const m = motoSegmentDuration(s, { ...DEFAULT_PROFILE, engineCc: 50 }, dry);
  assert.ok(m.motoS >= 10000 / (45 / 3.6) - 1e-6);
});

test('örnek: arabayla 1 saatlik İstanbul trafiği motorla çok daha kısa', () => {
  // 20 km: 12 km otoyol yoğun, 8 km şehir içi yavaş
  const r = route([
    ...Array.from({ length: 30 }, () => seg(400, 90, 4)),
    ...Array.from({ length: 20 }, () => seg(400, 40, 1.8)),
  ]);
  const m = computeMotoRoute(r, DEFAULT_PROFILE, dry);
  assert.ok(r.trafficS > 50 * 60, `car ${r.trafficS / 60} dk`);
  assert.ok(m.motoS < r.trafficS * 0.65, `moto ${m.motoS / 60} dk vs car ${r.trafficS / 60} dk`);
  assert.ok(m.savedS > 0);
  assert.equal(m.segments.length, 50);
});

test('congestionOf eşikleri', () => {
  assert.equal(congestionOf({ freeFlowS: 100, trafficS: 105 }), 'free');
  assert.equal(congestionOf({ freeFlowS: 100, trafficS: 130 }), 'slow');
  assert.equal(congestionOf({ freeFlowS: 100, trafficS: 200 }), 'jam');
});

test('güvenli mod en yüksek güvenlik puanlı makul rotayı öne alır', () => {
  const fast = computeMotoRoute(route([seg(10000, 90, 3)], 'fast'), DEFAULT_PROFILE, dry);
  const calm = computeMotoRoute(route([seg(10500, 80, 1.0)], 'calm'), DEFAULT_PROFILE, dry);
  const ranked = rankRoutes([fast, calm], 'safe');
  assert.ok(calm.safety.score > fast.safety.score);
  if (calm.motoS <= Math.min(fast.motoS, calm.motoS) * 1.25) assert.equal(ranked[0].route.id, 'calm');
  assert.equal(rankRoutes([calm, fast], 'fastest')[0].motoS, Math.min(fast.motoS, calm.motoS));
});
