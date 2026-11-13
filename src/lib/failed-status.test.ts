import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildFailedStatus, type FailedPaymentInput, type FailedStatusContext } from './failed-status.ts';

const NOW = new Date('2026-11-13T12:00:00Z');
const DAY = 86_400_000;
const ago = (days: number) => new Date(NOW.getTime() - days * DAY).toISOString();

const payment = (id: string, extra: Partial<FailedPaymentInput> = {}): FailedPaymentInput => ({
  paymentId: id, customerId: `cst_${id}`, donorName: `Donor ${id}`, email: `${id}@x.com`,
  amount: 10, currency: 'GBP', gateway: 'mollie', sequenceType: 'recurring', status: 'failed', failedAt: ago(5),
  ...extra,
});

const context = (extra: Partial<FailedStatusContext> = {}): FailedStatusContext => ({
  paidTimesByCustomer: new Map(), sentStages: new Set(), cancelledCustomerIds: new Set(), remindersEnabled: true, now: NOW,
  ...extra,
});

const one = (p: FailedPaymentInput, ctx: Partial<FailedStatusContext> = {}) => buildFailedStatus([p], context(ctx)).rows[0];

test('a failed recurring payment is a failed monthly charge', () => {
  const row = one(payment('a'));
  assert.equal(row.kind, 'monthly-charge');
  assert.equal(row.kindLabel, 'Failed monthly charge');
});

test('anything that is not recurring is a left-checkout row', () => {
  const row = one(payment('a', { sequenceType: 'first', status: 'expired' }));
  assert.equal(row.kind, 'abandoned-checkout');
  assert.equal(row.kindLabel, 'Left checkout, never a monthly donor');
});

test('abandoned checkouts are never emailed automatically', () => {
  const row = one(payment('a', { sequenceType: 'oneoff' }), { sentStages: new Set(['a:3']) });
  assert.equal(row.emailStatus, 'not-applicable');
});

test('the highest reminder stage sent wins', () => {
  assert.equal(one(payment('a'), { sentStages: new Set(['a:3']) }).emailStatus, 'sent-day-3');
  assert.equal(one(payment('a'), { sentStages: new Set(['a:3', 'a:7']) }).emailStatus, 'sent-day-7');
  assert.equal(one(payment('a'), { sentStages: new Set(['a:7']) }).emailStatus, 'sent-day-7');
});

test('a sent reminder is reported even if reminders are now switched off', () => {
  assert.equal(one(payment('a'), { sentStages: new Set(['a:3']), remindersEnabled: false }).emailStatus, 'sent-day-3');
});

test('nothing sent while reminders are off is reported as switched off', () => {
  assert.equal(one(payment('a'), { remindersEnabled: false }).emailStatus, 'switched-off');
});

test('a young failure is not due yet, an older one was not sent', () => {
  assert.equal(one(payment('a', { failedAt: ago(1) })).emailStatus, 'not-due-yet');
  assert.equal(one(payment('a', { failedAt: ago(3) })).emailStatus, 'not-sent');
  assert.equal(one(payment('a', { failedAt: ago(10) })).emailStatus, 'not-sent');
});

test('paying after the failure marks it fixed', () => {
  const row = one(payment('a'), { paidTimesByCustomer: new Map([['cst_a', [ago(2)]]]) });
  assert.equal(row.fixedStatus, 'paid-since');
});

test('a payment made before the failure does not count as fixed', () => {
  const row = one(payment('a'), { paidTimesByCustomer: new Map([['cst_a', [ago(40)]]]) });
  assert.equal(row.fixedStatus, 'still-unpaid');
});

test('a cancelled donor is cancelled unless they paid since', () => {
  const cancelled = new Set(['cst_a']);
  assert.equal(one(payment('a'), { cancelledCustomerIds: cancelled }).fixedStatus, 'cancelled');
  const paid = new Map([['cst_a', [ago(1)]]]);
  assert.equal(one(payment('a'), { cancelledCustomerIds: cancelled, paidTimesByCustomer: paid }).fixedStatus, 'paid-since');
});

test('rows are sorted still-unpaid first, then newest first', () => {
  const { rows } = buildFailedStatus(
    [payment('old', { failedAt: ago(9) }), payment('fixed', { failedAt: ago(1) }), payment('new', { failedAt: ago(4) })],
    context({ paidTimesByCustomer: new Map([['cst_fixed', [ago(0.5)]]]) })
  );
  assert.deepEqual(rows.map((r) => r.paymentId), ['new', 'old', 'fixed']);
});

test('uses the donor name, falling back to the email', () => {
  assert.equal(one(payment('a')).donor, 'Donor a');
  assert.equal(one(payment('a', { donorName: '' })).donor, 'a@x.com');
  assert.equal(one(payment('a', { donorName: '', email: '' })).donor, 'Unknown donor');
});

test('summary counts total, fixed, still unpaid and emailed', () => {
  const { summary } = buildFailedStatus(
    [payment('a'), payment('b'), payment('c'), payment('d', { sequenceType: 'first' })],
    context({
      paidTimesByCustomer: new Map([['cst_b', [ago(1)]]]),
      cancelledCustomerIds: new Set(['cst_c']),
      sentStages: new Set(['a:3', 'b:3']),
    })
  );
  assert.deepEqual(summary, { total: 4, fixed: 1, stillUnpaid: 2, emailed: 2 });
});

test('does not mutate its inputs', () => {
  const inputs = [payment('b', { failedAt: ago(2) }), payment('a', { failedAt: ago(8) })];
  const snapshot = JSON.stringify(inputs);
  buildFailedStatus(inputs, context());
  assert.equal(JSON.stringify(inputs), snapshot);
  assert.deepEqual(inputs.map((p) => p.paymentId), ['b', 'a']);
});
