import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildLostMatrix, type LostResponse } from './lost-donors.ts';

// 13 months: the first is only used to tell whether someone was lost in the 2nd.
const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

const donor = (key: string, present: string[], extra: Partial<LostResponse['donors'][number]> = {}) => ({
  key, label: key, email: `${key}@x.com`, gateway: 'mollie', amount: 5, present, ...extra,
});

const response = (donors: LostResponse['donors'], failedEmails: Record<string, string[]> = {}): LostResponse => ({
  months, donors, failedEmails,
});

test('donors who never stopped are not in the list', () => {
  const { rows } = buildLostMatrix(response([donor('steady', months)]));
  assert.equal(rows.length, 0);
});

test('compares each month with the one before it (first month is only context)', () => {
  const { months: shown } = buildLostMatrix(response([]));
  assert.deepEqual(shown, months.slice(1));
});

test('a donor who stops once is lost in that month and stays away afterwards', () => {
  const { rows } = buildLostMatrix(response([donor('a', ['2026-01', '2026-02', '2026-03'])]));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].cells['2026-04'], 'lost-no-charge');
  assert.equal(rows[0].cells['2026-05'], 'away');
  assert.equal(rows[0].cells['2026-03'], 'gave');
  assert.equal(rows[0].timesLost, 1);
  assert.equal(rows[0].stillAway, true);
  assert.equal(rows[0].returned, false);
});

test('a failed charge in the lost month marks the loss as fixable', () => {
  const { rows } = buildLostMatrix(
    response([donor('a', ['2026-01', '2026-02'], { email: 'A@X.com' })], { '2026-03': ['a@x.com'] })
  );
  assert.equal(rows[0].cells['2026-03'], 'lost-failed');
});

test('a donor who comes back and leaves again is a repeater', () => {
  const { rows, summary } = buildLostMatrix(
    response([donor('flap', ['2026-01', '2026-02', '2026-04', '2026-05'])])
  );
  assert.equal(rows[0].timesLost, 2);
  assert.deepEqual(rows[0].lostMonths, ['2026-03', '2026-06']);
  assert.equal(rows[0].returned, true);
  assert.equal(rows[0].stillAway, true);
  assert.equal(summary.repeaters, 1);
});

test('months before a donor first appeared are "before", not "away"', () => {
  const { rows } = buildLostMatrix(response([donor('late', ['2026-03', '2026-04'])]));
  assert.equal(rows[0].cells['2026-02'], 'before');
  assert.equal(rows[0].cells['2026-05'], 'lost-no-charge');
});

test('summary counts people, events, returns and quick returns', () => {
  const { summary } = buildLostMatrix(
    response([
      donor('gone', ['2026-01', '2026-02']),                       // lost in Mar, never back
      donor('quick', ['2026-01', '2026-02', '2026-04', '2026-05', '2026-06']), // lost Mar, back next month
      donor('steady', months),
    ])
  );
  assert.equal(summary.uniqueLost, 2);
  assert.equal(summary.lostEvents, 2);
  assert.equal(summary.returned, 1);
  assert.equal(summary.stillAway, 1);
  assert.equal(summary.returnedWithin2Months, 1);
  assert.equal(summary.eligibleEvents, 2);
  assert.deepEqual(summary.byMonth.find((m) => m.month === '2026-03'), { month: '2026-03', lost: 2 });
});

test('rows are ordered by how often they were lost, then most recently', () => {
  const { rows } = buildLostMatrix(
    response([
      donor('once-early', ['2026-01', '2026-02']),
      donor('twice', ['2026-01', '2026-03', '2026-04']),
      donor('once-late', ['2026-01', '2026-02', '2026-03', '2026-04']),
    ])
  );
  assert.deepEqual(rows.map((r) => r.key), ['twice', 'once-late', 'once-early']);
});

test('does not mutate its input', () => {
  const input = response([donor('a', ['2026-01', '2026-02'])]);
  const copy = JSON.parse(JSON.stringify(input));
  buildLostMatrix(input);
  assert.deepEqual(input, copy);
});
