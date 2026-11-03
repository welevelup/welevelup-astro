import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildKpiTrends } from './kpi-trends.ts';

const monthly = [
  { month: '2026-09', total: 900, monthly_donations: 800, active_subscribers: 125 },
  { month: '2026-10', total: 1000, monthly_donations: 850, active_subscribers: 124 },
  { month: '2026-11', total: 230.5, monthly_donations: 210.5, active_subscribers: 34 },
];
const flows = [
  { month: '2026-09', joined: 6, churned: 4, net: 2 },
  { month: '2026-10', joined: 6, churned: 7, net: -1 },
];

const byKey = (key: string) => {
  const found = buildKpiTrends(monthly, flows).find((m) => m.key === key);
  assert.ok(found, `metric ${key} should exist`);
  return found;
};

test('exposes the five clickable metrics', () => {
  const keys = buildKpiTrends(monthly, flows).map((m) => m.key);
  assert.deepEqual(keys, ['raised', 'donors', 'income', 'joined', 'lost']);
});

test('raised includes the in-progress month and says so', () => {
  const raised = byKey('raised');
  assert.equal(raised.points.length, 3);
  assert.equal(raised.points[2].value, 230.5);
  assert.match(raised.note ?? '', /still in progress/i);
  assert.equal(raised.money, true);
});

test('active donors uses complete months only', () => {
  const donors = byKey('donors');
  assert.deepEqual(donors.points.map((p) => p.month), ['2026-09', '2026-10']);
  assert.equal(donors.money, false);
});

test('joined and lost come from the flows', () => {
  assert.deepEqual(byKey('joined').points.map((p) => p.value), [6, 6]);
  assert.deepEqual(byKey('lost').points.map((p) => p.value), [4, 7]);
});

test('keeps at most the last 12 months', () => {
  const many = Array.from({ length: 15 }, (_, i) => ({
    month: `2025-${String((i % 12) + 1).padStart(2, '0')}`, total: i, monthly_donations: i, active_subscribers: i,
  }));
  assert.equal(buildKpiTrends(many, []).find((m) => m.key === 'raised')?.points.length, 12);
});

test('omits metrics that have no data', () => {
  assert.deepEqual(buildKpiTrends([], []).map((m) => m.key), []);
});

test('does not mutate its inputs', () => {
  const copy = JSON.parse(JSON.stringify(monthly));
  buildKpiTrends(monthly, flows);
  assert.deepEqual(monthly, copy);
});
