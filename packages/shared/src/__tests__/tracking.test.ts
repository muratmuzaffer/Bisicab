import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DistanceTracker, BILLING_TRACKER_OPTIONS } from '../tracking';

/** ~metre cinsinden kuzeye kaydır (kaba: 1° lat ≈ 111 km). */
function northOf(lat: number, lng: number, meters: number) {
  return { lat: lat + meters / 111_000, lng };
}

test('dururken küçük GPS jitter mesafe ve hız üretmez', () => {
  const t = new DistanceTracker();
  const base = { lat: 38.42, lng: 27.14 };
  let ts = 1_000_000;

  t.add({ ...base, accuracy: 8, timestamp: ts });
  // 1–2 m salınım (dururken tipik jitter)
  for (let i = 0; i < 10; i++) {
    ts += 3000;
    const jitter = (i % 2 === 0 ? 1.5 : -1.2);
    const p = northOf(base.lat, base.lng, jitter);
    const r = t.add({ ...p, accuracy: 8, timestamp: ts });
    assert.equal(r.accepted, false);
    assert.equal(r.speedKmh, 0);
  }
  assert.equal(t.totalDistanceKm, 0);
});

test('gerçek hareket (~30 m) kilidi açar ve mesafe ekler', () => {
  const t = new DistanceTracker();
  const base = { lat: 38.42, lng: 27.14 };
  let ts = 1_000_000;

  t.add({ ...base, accuracy: 5, timestamp: ts, speedMps: 0 });
  ts += 3000;
  // Kalman yumuşatması sonrası da unlock (8 m) üstünde kalsın diye ~30 m
  const moved = northOf(base.lat, base.lng, 30);
  const r = t.add({
    ...moved,
    accuracy: 5,
    timestamp: ts,
    speedMps: 4, // ~14.4 km/s
  });
  assert.equal(r.accepted, true);
  assert.ok(t.totalDistanceKm > 0.01);
  assert.ok(t.totalDistanceKm < 0.05);
});

test('aşırı hız (GPS zıplaması) mesafeye katılmaz', () => {
  const t = new DistanceTracker();
  const base = { lat: 38.42, lng: 27.14 };
  let ts = 1_000_000;

  t.add({ ...base, accuracy: 5, timestamp: ts });
  // Önce kilidi aç (Kalman sonrası >8 m)
  ts += 3000;
  t.add({
    ...northOf(base.lat, base.lng, 30),
    accuracy: 5,
    timestamp: ts,
    speedMps: 3,
  });
  const before = t.totalDistanceKm;
  assert.ok(before > 0);

  // 200 m / 1 sn ≈ 720 km/s — reddedilmeli
  ts += 1000;
  const r = t.add({
    ...northOf(base.lat, base.lng, 200),
    accuracy: 5,
    timestamp: ts,
  });
  assert.equal(r.accepted, false);
  if (!r.accepted) assert.equal(r.reason, 'over_speed');
  assert.equal(t.totalDistanceKm, before);
});

test('yavaş sürekli hareket birikir (10 m adımlar)', () => {
  const t = new DistanceTracker(BILLING_TRACKER_OPTIONS);
  const base = { lat: 38.42, lng: 27.14 };
  let ts = 1_000_000;
  let lat = base.lat;

  t.add({ ...base, accuracy: 6, timestamp: ts, speedMps: 1.5 });
  for (let i = 0; i < 4; i++) {
    ts += 3000;
    const p = northOf(lat, base.lng, 10);
    lat = p.lat;
    t.add({ ...p, accuracy: 6, timestamp: ts, speedMps: 2.5 });
  }
  assert.ok(t.totalDistanceKm > 0.02);
  assert.ok(t.totalDistanceKm < 0.055);
});

test('kötü accuracy mesafeye yazılmaz', () => {
  const t = new DistanceTracker();
  const base = { lat: 38.42, lng: 27.14 };
  let ts = 1_000_000;

  t.add({ ...base, accuracy: 5, timestamp: ts });
  ts += 3000;
  const r = t.add({
    ...northOf(base.lat, base.lng, 20),
    accuracy: 80,
    timestamp: ts,
  });
  assert.equal(r.accepted, false);
  if (!r.accepted) assert.equal(r.reason, 'poor_accuracy');
  assert.equal(t.totalDistanceKm, 0);
});
