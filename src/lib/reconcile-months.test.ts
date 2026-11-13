import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileMonths, type Gift, type Failure, type Subscription } from './reconcile-months.ts';

const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

const gift = (email: string, month: string, gateway = 'mollie', extra: Partial<Gift> = {}): Gift => ({
  month, name: email.split('@')[0], email, amount: 10, gateway, ...extra,
});
const gifts = (email: string, ms: string[], gateway = 'mollie') => ms.map((m) => gift(email, m, gateway));
const run = (g: Gift[], f: Failure[] = [], s: Subscription[] = []) => reconcileMonths({ months, gifts: g, failures: f, subscriptions: s });

test('the first month is context only and never a column', () => {
  assert.deepEqual(run([]).months, months.slice(1));
});

test('someone who keeps giving is not lost', () => {
  assert.equal(run(gifts('a@x.com', months)).rows.length, 0);
});

test('a donor is lost in the month after their last gift', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].month, '2026-03');
  assert.equal(rows[0].email, 'a@x.com');
});

test('a failed charge in the lost month is the reason, with its gateway', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02']), [{ month: '2026-03', email: 'A@x.com', gateway: 'gocardless' }]);
  assert.equal(rows[0].reason, 'failed-charge');
  assert.match(rows[0].evidence, /gocardless/);
});

test('failed charge wins over a known quarterly subscription', () => {
  const { rows } = run(
    gifts('a@x.com', ['2026-01', '2026-02']),
    [{ month: '2026-03', email: 'a@x.com', gateway: 'mollie' }],
    [{ email: 'a@x.com', gateway: 'mollie', interval: 'quarterly', status: 'active' }]
  );
  assert.equal(rows[0].reason, 'failed-charge');
});

test('a known quarterly or yearly subscription is not-monthly', () => {
  for (const interval of ['quarterly', 'yearly', 'other'] as const) {
    const { rows } = run(gifts('a@x.com', ['2026-01']), [], [{ email: 'a@x.com', gateway: 'mollie', interval, status: 'active' }]);
    assert.equal(rows[0].reason, 'not-monthly', interval);
  }
});

test('a monthly subscription alongside a quarterly one is not treated as not-monthly', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01']), [], [
    { email: 'a@x.com', gateway: 'mollie', interval: 'quarterly', status: 'canceled' },
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'active' },
  ]);
  assert.notEqual(rows[0].reason, 'not-monthly');
});

test('with no subscription info, gifts every 3 months mean not-monthly', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-04']));
  assert.deepEqual(rows.map((r) => [r.month, r.reason]), [['2026-02', 'not-monthly'], ['2026-05', 'not-monthly']]);
});

test('with unknown interval, gifts 12 months apart mean not-monthly', () => {
  const wide = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02'];
  const out = reconcileMonths({
    months: wide,
    gifts: [gift('a@x.com', '2025-01'), gift('a@x.com', '2026-01')],
    failures: [],
    subscriptions: [{ email: 'a@x.com', gateway: 'mollie', interval: 'unknown', status: 'active' }],
  });
  assert.ok(out.rows.length > 0);
  assert.ok(out.rows.every((r) => r.reason === 'not-monthly'));
});

test('irregular gaps are not mistaken for quarterly giving', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02', '2026-05']));
  assert.equal(rows.find((r) => r.month === '2026-03')?.reason, 'nothing-found');
});

test('two subscriptions on one gateway explain the gap', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02']), [], [
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'pending' },
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'active' },
  ]);
  assert.equal(rows[0].reason, 'two-subscriptions');
});

test('one subscription on each of two gateways is not a replacement gap', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02']), [], [
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'active' },
    { email: 'a@x.com', gateway: 'gocardless', interval: 'monthly', status: 'active' },
  ]);
  assert.equal(rows[0].reason, 'nothing-found');
});

test('a PayPal donor with nothing else found is no-failure-data', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02'], 'paypal'));
  assert.equal(rows[0].reason, 'no-failure-data');
  assert.match(rows[0].evidence, /PayPal/);
});

test('everything else is nothing-found', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02']));
  assert.equal(rows[0].reason, 'nothing-found');
});

test('counts per month and a grand summary add up', () => {
  const out = run(
    [...gifts('fail@x.com', ['2026-01']), ...gifts('gone@x.com', ['2026-01']), ...gifts('pp@x.com', ['2026-01'], 'paypal')],
    [{ month: '2026-02', email: 'fail@x.com', gateway: 'mollie' }],
    [{ email: 'gone@x.com', gateway: 'mollie', interval: 'quarterly', status: 'active' }]
  );
  const feb = out.byMonth.find((m) => m.month === '2026-02')!;
  assert.equal(feb.total, 3);
  assert.equal(feb.counts['failed-charge'], 1);
  assert.equal(feb.counts['not-monthly'], 1);
  assert.equal(feb.counts['no-failure-data'], 1);
  assert.equal(out.summary.totalLost, 3);
  assert.equal(out.summary.reallyLost, 1);
  assert.equal(out.summary.falseAlarm, 1);
  assert.equal(out.summary.unknown, 1);
  assert.equal(out.summary.reallyLost + out.summary.falseAlarm + out.summary.unknown, out.summary.totalLost);
});

test('a donor with no email is keyed by name and still counted', () => {
  const { rows } = run([gift('', '2026-01', 'paypal', { name: 'Sam Jones' })]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Sam Jones');
});

test('does not mutate its inputs', () => {
  const g = gifts('a@x.com', ['2026-02', '2026-01']);
  const snapshot = JSON.stringify(g);
  run(g);
  assert.equal(JSON.stringify(g), snapshot);
});
