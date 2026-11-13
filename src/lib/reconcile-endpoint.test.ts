import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mollieInterval, gocardlessInterval, resolveMonths } from '../../api/admin-reconcile-months.ts';

test('Mollie interval text maps to monthly, quarterly, yearly or other', () => {
  assert.equal(mollieInterval('1 month'), 'monthly');
  assert.equal(mollieInterval('1 months'), 'monthly');
  assert.equal(mollieInterval('3 months'), 'quarterly');
  assert.equal(mollieInterval('12 months'), 'yearly');
  assert.equal(mollieInterval('1 year'), 'yearly');
  assert.equal(mollieInterval('2 weeks'), 'other');
  assert.equal(mollieInterval('6 months'), 'half-yearly');
  assert.equal(mollieInterval('2 months'), 'other');
  assert.equal(mollieInterval(''), 'unknown');
});

test('GoCardless interval unit and count map the same way', () => {
  assert.equal(gocardlessInterval('monthly', 1), 'monthly');
  assert.equal(gocardlessInterval('monthly', 3), 'quarterly');
  assert.equal(gocardlessInterval('yearly', 1), 'yearly');
  assert.equal(gocardlessInterval('monthly', 6), 'half-yearly');
  assert.equal(gocardlessInterval('weekly', 1), 'other');
  assert.equal(gocardlessInterval('', 1), 'unknown');
});

test('resolveMonths adds one context month and enforces the limits', () => {
  assert.deepEqual(resolveMonths('2026-01', '2026-03'), { months: ['2025-12', '2026-01', '2026-02', '2026-03'] });
  assert.ok('error' in resolveMonths('2026-5', '2026-06'));
  assert.ok('error' in resolveMonths('2026-06', '2026-01'));
  assert.ok('error' in resolveMonths('2024-01', '2026-01'));
  assert.ok('error' in resolveMonths('2026-01', '2099-01'));
});
