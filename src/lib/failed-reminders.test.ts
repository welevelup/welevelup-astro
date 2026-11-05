import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectReminders, type FailedCharge } from '../../api/failed-payment-reminders.ts';

const NOW = new Date('2026-11-10T10:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86400000).toISOString();
const failed = (id: string, ageDays: number, customerId = 'cst_1'): FailedCharge => ({
  paymentId: id, customerId, amount: '5.00', failedAt: daysAgo(ageDays),
});
const run = (charges: FailedCharge[], over: Partial<Parameters<typeof selectReminders>[0]> = {}) =>
  selectReminders({ charges, paidAfter: () => false, alreadySent: () => false, now: NOW, ...over });

test('nothing is sent in the first 3 days', () => {
  assert.deepEqual(run([failed('tr_1', 2)]), []);
});

test('a failure 3 to 6 days old gets the first reminder', () => {
  assert.deepEqual(run([failed('tr_1', 3)]).map((r) => r.stage), [3]);
  assert.deepEqual(run([failed('tr_1', 6)]).map((r) => r.stage), [3]);
});

test('a failure 7 to 13 days old gets the second reminder', () => {
  assert.deepEqual(run([failed('tr_1', 7)]).map((r) => r.stage), [7]);
  assert.deepEqual(run([failed('tr_1', 13)]).map((r) => r.stage), [7]);
});

test('failures older than two weeks are left alone', () => {
  assert.deepEqual(run([failed('tr_1', 14)]), []);
});

test('a reminder that was already sent is not sent again', () => {
  const sent = new Set(['tr_1:3']);
  assert.deepEqual(run([failed('tr_1', 4)], { alreadySent: (id, s) => sent.has(`${id}:${s}`) }), []);
});

test('nobody is reminded after they paid again', () => {
  assert.deepEqual(run([failed('tr_1', 4)], { paidAfter: () => true }), []);
});

test('only one reminder per donor, for their most recent failure', () => {
  const out = run([failed('tr_old', 8), failed('tr_new', 4)]);
  assert.deepEqual(out.map((r) => r.paymentId), ['tr_new']);
});

test('different donors are handled independently', () => {
  const out = run([failed('tr_a', 4, 'cst_a'), failed('tr_b', 8, 'cst_b')]);
  assert.deepEqual(out.map((r) => [r.customerId, r.stage]).sort(), [['cst_a', 3], ['cst_b', 7]]);
});

test('does not mutate its input', () => {
  const charges = [failed('tr_1', 4)];
  const copy = JSON.parse(JSON.stringify(charges));
  run(charges);
  assert.deepEqual(charges, copy);
});
