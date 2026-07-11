import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateFare } from '../pricing';

test('2.5 km altı başlangıç ücreti: 150', () => {
  assert.equal(calculateFare(1.8).total, 150);
  assert.equal(calculateFare(0).total, 150);
});

test('tam 2.5 km sınırı: 150', () => {
  assert.equal(calculateFare(2.5).total, 150);
});

test('2.5 km üzeri: 150 + fazla km * 45', () => {
  // 4 km -> 1.5 fazla km * 45 = 67.5 -> 150 + 67.5 = 217.5
  assert.equal(calculateFare(4).total, 217.5);
  // 5.5 km -> 3 fazla * 45 = 135 -> 285
  assert.equal(calculateFare(5.5).total, 285);
});

test('negatif / NaN mesafe 0 kabul edilir → 150', () => {
  assert.equal(calculateFare(-3).total, 150);
  assert.equal(calculateFare(Number.NaN).total, 150);
});
