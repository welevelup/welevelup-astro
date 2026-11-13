import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mollieInterval, gocardlessInterval, resolveMonths, fetchJson, withDeadline } from '../../api/admin-reconcile-months.ts';

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

const withFetch = async (replies: Array<{ status: number; headers?: Record<string, string> }>, run: () => Promise<void>) => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    const reply = replies[Math.min(calls++, replies.length - 1)];
    return new Response(JSON.stringify({ ok: reply.status === 200 }), { status: reply.status, headers: reply.headers });
  }) as typeof fetch;
  try { await run(); } finally { globalThis.fetch = original; }
  return calls;
};

test('fetchJson retries once on HTTP 429 and then succeeds', async () => {
  let result: any;
  const calls = await withFetch([{ status: 429, headers: { 'Retry-After': '0' } }, { status: 200 }], async () => {
    result = await fetchJson('https://example.test/x');
  });
  assert.equal(calls, 2);
  assert.deepEqual(result, { ok: true });
});

test('fetchJson gives up after one retry', async () => {
  let failed = false;
  const calls = await withFetch([{ status: 429, headers: { 'Retry-After': '0' } }], async () => {
    await fetchJson('https://example.test/x').catch(() => { failed = true; });
  });
  assert.equal(calls, 2);
  assert.ok(failed);
});

test('fetchJson does not retry other errors', async () => {
  const calls = await withFetch([{ status: 500 }], async () => {
    await fetchJson('https://example.test/x').catch(() => undefined);
  });
  assert.equal(calls, 1);
});

test('withDeadline returns the fallback when the job is too slow, and the result when it is not', async () => {
  const slow = new Promise<string>((resolve) => setTimeout(() => resolve('late'), 200));
  assert.equal(await withDeadline(slow, 10, 'fallback'), 'fallback');
  assert.equal(await withDeadline(Promise.resolve('fast'), 200, 'fallback'), 'fast');
});
