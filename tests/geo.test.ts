/// <reference types="node" />
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { segmentsFromGoogleRoute, type GRoute } from '../src/services/routing/google';
import { buildSegments } from '../src/services/routing/osrm';
import { scorePlaces } from '../src/services/places';
import { estimatedTrafficFactor } from '../src/services/trafficModel';
import { isInTurkey, pathLength } from '../src/utils/geo';
import { decodePolyline } from '../src/utils/polyline';

test('polyline çözümü (Google örneği)', () => {
  const pts = decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.equal(pts.length, 3);
  assert.deepEqual(pts[0], { latitude: 38.5, longitude: -120.2 });
  assert.deepEqual(pts[2], { latitude: 43.252, longitude: -126.453 });
});

test('Türkiye sınır kontrolü', () => {
  assert.ok(isInTurkey({ latitude: 41.0082, longitude: 28.9784 })); // İstanbul
  assert.ok(isInTurkey({ latitude: 39.9334, longitude: 32.8597 })); // Ankara
  assert.ok(isInTurkey({ latitude: 39.9, longitude: 43.0 })); // Doğubayazıt civarı
  assert.ok(!isInTurkey({ latitude: 48.85, longitude: 2.35 })); // Paris
});

test('tahmini trafik: İstanbul hafta içi 08:15 > gece 03:00 ve şehirlerarası', () => {
  const ist = { latitude: 41.03, longitude: 28.98 };
  const rush = estimatedTrafficFactor(ist, 'primary', new Date(2026, 10, 9, 8, 15)); // Pazartesi
  const night = estimatedTrafficFactor(ist, 'primary', new Date(2026, 10, 9, 3, 0));
  const rural = estimatedTrafficFactor({ latitude: 39.0, longitude: 34.0 }, 'trunk', new Date(2026, 10, 9, 8, 15));
  assert.ok(rush > 1.8, `rush ${rush}`);
  assert.ok(night < 1.2);
  assert.ok(rural < 1.1);
});

test('OSRM anotasyonlarından parça üretimi mesafe ve süreyi korur', () => {
  const coords = Array.from({ length: 21 }, (_, i) => ({ latitude: 41, longitude: 29 + i * 0.001 }));
  const distances = Array(20).fill(84);
  const durations = Array(20).fill(6);
  const segs = buildSegments(coords, distances, durations, new Date(2026, 10, 9, 3, 0));
  const d = segs.reduce((a, s) => a + s.distanceM, 0);
  const t = segs.reduce((a, s) => a + s.freeFlowS, 0);
  assert.equal(Math.round(d), 1680);
  assert.equal(Math.round(t), 120);
  assert.ok(segs.length >= 4);
  assert.ok(segs.every((s) => s.trafficS >= s.freeFlowS));
});

test('Google hız bantlarına göre gecikme dağıtımı', () => {
  const pts = Array.from({ length: 11 }, (_, i) => ({ latitude: 41, longitude: 29 + i * 0.01 }));
  const enc = encode(pts);
  const len = pathLength(pts);
  const r: GRoute = {
    distanceMeters: Math.round(len),
    staticDuration: '600s',
    duration: '1200s',
    polyline: { encodedPolyline: enc },
    travelAdvisory: {
      speedReadingIntervals: [
        { endPolylinePointIndex: 5, speed: 'NORMAL' },
        { startPolylinePointIndex: 5, endPolylinePointIndex: 10, speed: 'TRAFFIC_JAM' },
      ],
    },
  };
  const segs = segmentsFromGoogleRoute(r, decodePolyline(enc));
  const free = segs.reduce((a, s) => a + s.freeFlowS, 0);
  const traffic = segs.reduce((a, s) => a + s.trafficS, 0);
  assert.ok(Math.abs(free - 600) < 1);
  assert.ok(Math.abs(traffic - 1200) < 1);
  const half = segs.length / 2;
  const firstDelay = segs.slice(0, half).reduce((a, s) => a + s.trafficS - s.freeFlowS, 0);
  const lastDelay = segs.slice(half).reduce((a, s) => a + s.trafficS - s.freeFlowS, 0);
  assert.ok(lastDelay > firstDelay * 10);
});

test('moto dostu puanlama', () => {
  const places = scorePlaces([
    { type: 'node', id: 1, lat: 41, lon: 29, tags: { amenity: 'fuel', opening_hours: '24/7', name: 'X Petrol' } },
    { type: 'node', id: 2, lat: 41.0005, lon: 29, tags: { amenity: 'motorcycle_parking' } },
    { type: 'node', id: 3, lat: 41.01, lon: 29, tags: { amenity: 'cafe', name: 'Biker Kafe' } },
    { type: 'node', id: 4, lat: 41.02, lon: 29, tags: { amenity: 'cafe', name: 'Sıradan Kafe' } },
    { type: 'way', id: 5, center: { lat: 41.03, lon: 29 }, tags: { shop: 'motorcycle', name: 'Moto Servis' } },
  ]);
  const by = Object.fromEntries(places.map((p) => [p.id, p]));
  assert.equal(by['node/1'].motoFriendly, true); // 7/24 + yakın park
  assert.equal(by['node/3'].motoFriendly, true); // isim
  assert.equal(by['node/4'].motoFriendly, false);
  assert.equal(by['way/5'].category, 'service');
  assert.equal(by['way/5'].motoFriendly, true);
});

function encode(pts: { latitude: number; longitude: number }[]): string {
  let out = '', pLat = 0, pLng = 0;
  const enc = (v: number) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) {
      s += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    return s + String.fromCharCode(v + 63);
  };
  for (const p of pts) {
    const lat = Math.round(p.latitude * 1e5), lng = Math.round(p.longitude * 1e5);
    out += enc(lat - pLat) + enc(lng - pLng);
    pLat = lat; pLng = lng;
  }
  return out;
}
