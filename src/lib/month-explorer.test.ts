import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  failedForMonth,
  failedEmailSet,
  classifyStopped,
  confirmedCancellations,
  recentMonths,
  monthLabel,
  fromFetched,
  type FailedTx,
} from './month-explorer.ts';

const failed: FailedTx[] = [
  { date: '2026-10-08', amount: 55, currency: 'GBP', gateway: 'mollie', payer: 'Unknown' },
  { date: '2026-10-26', amount: 5, currency: 'GBP', gateway: 'mollie', payer: 'LouisBreyer@iCloud.com' },
  { date: '2026-11-02', amount: 5, currency: 'GBP', gateway: 'mollie', payer: 'anjelica@gmail.com' },
];

test('failedForMonth returns only that month, newest first', () => {
  const rows = failedForMonth(failed, '2026-10');
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2026-10-26');
  assert.equal(rows[1].date, '2026-10-08');
});

test('failedForMonth does not mutate its input', () => {
  const copy = [...failed];
  failedForMonth(failed, '2026-10');
  assert.deepEqual(failed, copy);
});

test('failedEmailSet lowercases and skips non-email payers', () => {
  const set = failedEmailSet(failed, '2026-10');
  assert.ok(set.has('louisbreyer@icloud.com'));
  assert.equal(set.size, 1);
});

test('classifyStopped marks donors with a failed charge as fixable, others as no_charge', () => {
  const lost = [
    { label: 'Louis', email: 'louisbreyer@icloud.com', gateway: 'mollie', amount: 5 },
    { label: 'Someone', email: 'x@y.com', gateway: 'paypal', amount: 5 },
  ];
  const out = classifyStopped(lost, failedEmailSet(failed, '2026-10'));
  assert.equal(out[0].reason, 'failed');
  assert.equal(out[1].reason, 'no_charge');
});

test('classifyStopped keeps a reason that is already known', () => {
  const out = classifyStopped(
    [{ label: 'A', gateway: 'gocardless', amount: 5, reason: 'cancelled' as const }],
    new Set()
  );
  assert.equal(out[0].reason, 'cancelled');
});

test('recentMonths returns the last n months, newest first', () => {
  const months = recentMonths([{ month: '2026-08' }, { month: '2026-09' }, { month: '2026-10' }], 2);
  assert.deepEqual(months, ['2026-10', '2026-09']);
});

test('monthLabel formats YYYY-MM', () => {
  assert.equal(monthLabel('2026-10'), 'Oct 2026');
  assert.equal(monthLabel('bad'), 'bad');
});

test('fromFetched prefers name, falls back to email, then "unknown"', () => {
  const rows = fromFetched([
    { name: 'Ana', email: 'a@x.com', gateway: 'mollie', amount: 5 },
    { name: 'unknown', email: 'b@x.com', gateway: 'mollie', amount: 5 },
    { name: '', email: '', gateway: 'paypal', amount: 2 },
  ]);
  assert.equal(rows[0].label, 'Ana');
  assert.equal(rows[1].label, 'b@x.com');
  assert.equal(rows[2].label, 'unknown');
});

test('confirmedCancellations keeps only cancellations reported by the gateway', () => {
  const rows = [
    { key: 'a', label: 'A', gateway: 'mollie', amount: 5, reason: 'cancelled' as const },
    { key: 'b', label: 'B', gateway: 'gocardless', amount: 5, reason: 'no_charge' as const },
    { key: 'c', label: 'C', gateway: 'mollie', amount: 5, reason: 'failed' as const },
  ];
  assert.deepEqual(confirmedCancellations(rows).map((r) => r.key), ['a']);
});

test('confirmedCancellations returns nothing when no stop was confirmed as a cancellation', () => {
  const rows = [{ key: 'b', label: 'B', gateway: 'gocardless', amount: 5, reason: 'no_charge' as const }];
  assert.deepEqual(confirmedCancellations(rows), []);
});
