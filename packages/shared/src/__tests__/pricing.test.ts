import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateFare } from '../pricing';

test('2.5 km altı sabit ücret: 35 + 150 = 185', () => {
  assert.equal(calculateFare(1.8).total, 185);
  assert.equal(calculateFare(0).total, 185);
});

test('tam 2.5 km sınırı: 185', () => {
  assert.equal(calculateFare(2.5).total, 185);
});

test('2.5 km üzeri: 35 + 150 + (fazla km * 45)', () => {
  // 4 km -> 1.5 fazla km * 45 = 67.5 -> 185 + 67.5 = 252.5
  assert.equal(calculateFare(4).total, 252.5);
  // 5.5 km -> 3 fazla km * 45 = 135 -> 320
  assert.equal(calculateFare(5.5).total, 320);
});

test('geçersiz mesafe 0 kabul edilir', () => {
  assert.equal(calculateFare(-3).total, 185);
  assert.equal(calculateFare(Number.NaN).total, 185);
});
