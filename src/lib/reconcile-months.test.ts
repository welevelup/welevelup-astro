import { test } from 'node:test';
import assert from 'node:assert/strict';
import { reconcileMonths, type Gift, type Failure, type Subscription } from './reconcile-months.ts';

const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];

const gift = (email: string, month: string, gateway = 'mollie', extra: Partial<Gift> = {}): Gift => ({
  month, name: email.split('@')[0], email, amount: 10, gateway, ...extra,
});
const gifts = (email: string, ms: string[], gateway = 'mollie') => ms.map((m) => gift(email, m, gateway));
const wide = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08'];
const runWide = (g: Gift[], f: Failure[] = [], sub: Subscription[] = []) => reconcileMonths({ months: wide, gifts: g, failures: f, subscriptions: sub });
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
  assert.match(rows[0].evidence, /GoCardless/);
  assert.match(rows[0].evidence, /2026-03/);
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
  for (const interval of ['quarterly', 'half-yearly', 'yearly'] as const) {
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

test('with no subscription info, three gifts 3 months apart are inferred as not-monthly, and the evidence says so', () => {
  const { rows } = runWide(gifts('a@x.com', ['2026-01', '2026-04', '2026-07']));
  assert.deepEqual(rows.map((r) => [r.month, r.reason]), [['2026-02', 'not-monthly'], ['2026-05', 'not-monthly'], ['2026-08', 'not-monthly']]);
  assert.match(rows[0].evidence, /inferred/i);
});

test('two gifts 3 months apart are not enough to infer quarterly giving', () => {
  const { rows } = runWide(gifts('a@x.com', ['2026-01', '2026-04']));
  assert.ok(rows.length > 0);
  assert.ok(rows.every((r) => r.reason === 'nothing-found'));
});

test('a failed charge in a gap month blocks the quarterly inference', () => {
  const { rows } = runWide(gifts('a@x.com', ['2026-01', '2026-04', '2026-07']), [{ month: '2026-03', email: 'a@x.com', gateway: 'mollie' }]);
  assert.equal(rows.find((r) => r.month === '2026-02')?.reason, 'nothing-found');
});

test('gifts 12 months apart are never inferred as yearly: that needs subscription data', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02']), [], [{ email: 'a@x.com', gateway: 'mollie', interval: 'yearly', status: 'active' }]);
  assert.equal(rows[0].reason, 'not-monthly');
  assert.match(rows[0].evidence, /once a year/);
});

test('a cancelled quarterly subscription is a real loss, not a false alarm', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01']), [], [{ email: 'a@x.com', gateway: 'mollie', interval: 'quarterly', status: 'canceled' }]);
  assert.equal(rows[0].reason, 'nothing-found');
  assert.match(rows[0].evidence, /cancelled/);
});

test('a cancelled subscription blocks the quarterly inference', () => {
  const { rows } = runWide(gifts('a@x.com', ['2026-01', '2026-04', '2026-07']), [], [
    { email: 'a@x.com', gateway: 'mollie', interval: 'unknown', status: 'canceled' },
  ]);
  assert.ok(rows.every((r) => r.reason === 'nothing-found'));
});

test('weekly or other short intervals behave like monthly: a miss is a real loss', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01']), [], [{ email: 'a@x.com', gateway: 'mollie', interval: 'other', status: 'active' }]);
  assert.equal(rows[0].reason, 'nothing-found');
});

test('a pending quarterly subscription counts as live', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01']), [], [{ email: 'a@x.com', gateway: 'mollie', interval: 'quarterly', status: 'pending' }]);
  assert.equal(rows[0].reason, 'not-monthly');
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

test('a cancelled subscription plus a new one is not two live subscriptions', () => {
  const { rows } = run(gifts('a@x.com', ['2026-01', '2026-02']), [], [
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'canceled' },
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'active' },
  ]);
  assert.equal(rows[0].reason, 'nothing-found');
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

const thirteen = Array.from({ length: 13 }, (_, i) => `${2025 + Math.floor((1 + i) / 12)}-${String(((1 + i) % 12) + 1).padStart(2, '0')}`);
// 2025-02 ... 2026-02
const runThirteen = (g: Gift[], f: Failure[] = [], sub: Subscription[] = []) =>
  reconcileMonths({ months: thirteen, gifts: g, failures: f, subscriptions: sub });
const feb25to26 = (email: string, skip: string[], twice: string[] = []) =>
  thirteen.filter((m) => !skip.includes(m)).flatMap((m) => (twice.includes(m) ? [gift(email, m), gift(email, m)] : [gift(email, m)]));

test('two gifts in the next month mean the lost month was paid late', () => {
  const { rows } = runThirteen(feb25to26('a@x.com', ['2025-12'], ['2026-01']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].month, '2025-12');
  assert.equal(rows[0].reason, 'paid-late');
  assert.equal(rows[0].evidence, 'Looks like a catch-up: paid twice in 2026-01, so the 2025-12 payment was probably collected a month late.');
});

test('one gift in the next month means the donor missed one payment but came back', () => {
  const { rows } = runThirteen(feb25to26('a@x.com', ['2025-12']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'came-back');
  assert.equal(rows[0].evidence, 'Gave again in 2026-01 but the 2025-12 payment was not recovered.');
});

test('a failed charge still wins over paid-late and came-back', () => {
  const { rows } = runThirteen(feb25to26('a@x.com', ['2025-12'], ['2026-01']), [{ month: '2025-12', email: 'a@x.com', gateway: 'mollie' }]);
  assert.equal(rows[0].reason, 'failed-charge');
});

test('not-monthly and two-subscriptions still win over paid-late', () => {
  const quarterly = runThirteen(feb25to26('a@x.com', ['2025-12'], ['2026-01']), [], [{ email: 'a@x.com', gateway: 'mollie', interval: 'quarterly', status: 'active' }]);
  assert.equal(quarterly.rows[0].reason, 'not-monthly');
  const doubled = runThirteen(feb25to26('b@x.com', ['2025-12'], ['2026-01']), [], [
    { email: 'b@x.com', gateway: 'mollie', interval: 'monthly', status: 'active' },
    { email: 'b@x.com', gateway: 'mollie', interval: 'monthly', status: 'pending' },
  ]);
  assert.equal(doubled.rows[0].reason, 'two-subscriptions');
});

test('paid-late and came-back beat no-failure-data for a PayPal donor', () => {
  const g = feb25to26('a@x.com', ['2025-12'], ['2026-01']).map((x) => ({ ...x, gateway: 'paypal' }));
  assert.equal(runThirteen(g).rows[0].reason, 'paid-late');
});

test('in the last month there is no later month to compare, and the evidence says so', () => {
  const { rows } = runThirteen(feb25to26('a@x.com', ['2026-02']));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].month, '2026-02');
  assert.equal(rows[0].reason, 'nothing-found');
  assert.match(rows[0].evidence, /no later month to compare/i);
});

test('in the last month a PayPal donor is still no-failure-data, with the same note', () => {
  const g = feb25to26('a@x.com', ['2026-02']).map((x) => ({ ...x, gateway: 'paypal' }));
  const { rows } = runThirteen(g);
  assert.equal(rows[0].reason, 'no-failure-data');
  assert.match(rows[0].evidence, /no later month to compare/i);
});

test('the summary groups paid-late as a false alarm and came-back on its own', () => {
  const out = runThirteen([
    ...feb25to26('late@x.com', ['2025-12'], ['2026-01']),
    ...feb25to26('back@x.com', ['2025-12']),
    ...feb25to26('gone@x.com', ['2026-02']),
    ...feb25to26('pp@x.com', ['2026-02']).map((x) => ({ ...x, gateway: 'paypal' })),
  ]);
  const s = out.summary;
  assert.equal(s.counts['paid-late'], 1);
  assert.equal(s.counts['came-back'], 1);
  assert.equal(s.falseAlarm, 1);
  assert.equal(s.missedButReturned, 1);
  assert.equal(s.reallyLost, 1);
  assert.equal(s.unknown, 1);
  assert.equal(s.reallyLost + s.falseAlarm + s.missedButReturned + s.unknown, s.totalLost);
  assert.equal(
    s.line,
    'Of 4 lost donor-months, 1 look really lost, 1 are false alarms, 1 missed a payment but the donor came back, and 1 cannot be told (PayPal gives no failure data).'
  );
});

// Gifts for a donor across the thirteen-month window with full control of each month's gifts.
const monthGifts = (email: string, plan: Record<string, Array<Partial<Gift>>>): Gift[] =>
  thirteen.flatMap((m) => (plan[m] ?? [{}]).map((extra) => gift(email, m, 'mollie', extra)));
const none: Record<string, Array<Partial<Gift>>> = { '2025-12': [] };

test('a donor who normally gives twice a month is not paid-late: 2/0/2 is came-back', () => {
  const g = monthGifts('a@x.com', { ...none, '2025-11': [{}, {}], '2026-01': [{}, {}] });
  const row = runThirteen(g).rows.find((r) => r.month === '2025-12')!;
  assert.equal(row.reason, 'came-back');
});

test('a 2/0/2 pattern across the year boundary uses the donor own baseline', () => {
  const g = monthGifts('a@x.com', { '2025-11': [{}, {}], '2025-12': [], '2026-01': [{}, {}], '2026-02': [{}, {}] });
  assert.equal(runThirteen(g).rows.find((r) => r.month === '2025-12')?.reason, 'came-back');
});

test('one gift on each of two gateways next month is a provider switch, not a catch-up', () => {
  const g = [
    ...thirteen.filter((m) => m <= '2025-11').map((m) => gift('a@x.com', m, 'gocardless')),
    gift('a@x.com', '2026-01', 'gocardless'),
    gift('a@x.com', '2026-01', 'paypal'),
  ];
  assert.equal(runThirteen(g).rows.find((r) => r.month === '2025-12')?.reason, 'came-back');
});

test('a monthly donor with one different-sized extra gift next month is came-back, not paid-late', () => {
  const g = monthGifts('a@x.com', { ...none, '2026-01': [{}, { amount: 25 }] });
  assert.equal(runThirteen(g).rows.find((r) => r.month === '2025-12')?.reason, 'came-back');
});

test('the catch-up must repeat one of their previous gifts (same gateway, same amount)', () => {
  const g = [
    ...thirteen.filter((m) => m <= '2025-11' && m !== '2025-11').map((m) => gift('a@x.com', m)),
    gift('a@x.com', '2025-11', 'mollie', { amount: 10 }),
    gift('a@x.com', '2025-11', 'paypal', { amount: 3 }),
    gift('a@x.com', '2026-01', 'mollie', { amount: 10 }),
    gift('a@x.com', '2026-01', 'mollie', { amount: 10 }),
    gift('a@x.com', '2026-01', 'mollie', { amount: 10 }),
  ];
  // The 10 on Mollie is repeated three times, and 3 gifts is more than the 2 made in November.
  assert.equal(runThirteen(g).rows.find((r) => r.month === '2025-12')?.reason, 'paid-late');
});

test('a PayPal donor who gives once next month is came-back', () => {
  const g = monthGifts('a@x.com', none).map((x) => ({ ...x, gateway: 'paypal' }));
  assert.equal(runThirteen(g).rows.find((r) => r.month === '2025-12')?.reason, 'came-back');
});

test('a PayPal donor who pays twice next month on PayPal is paid-late', () => {
  const g = monthGifts('a@x.com', { ...none, '2026-01': [{}, {}] }).map((x) => ({ ...x, gateway: 'paypal' }));
  assert.equal(runThirteen(g).rows.find((r) => r.month === '2025-12')?.reason, 'paid-late');
});

test('a failed charge on another gateway still beats paid-late and came-back', () => {
  const late = monthGifts('a@x.com', { ...none, '2026-01': [{}, {}] });
  const failure: Failure = { month: '2025-12', email: 'a@x.com', gateway: 'gocardless' };
  assert.equal(runThirteen(late, [failure]).rows.find((r) => r.month === '2025-12')?.reason, 'failed-charge');
  assert.equal(runThirteen(monthGifts('b@x.com', none), [{ ...failure, email: 'b@x.com' }]).rows.find((r) => r.month === '2025-12')?.reason, 'failed-charge');
});

test('a donor absent next month too is not paid-late or came-back', () => {
  const g = thirteen.filter((m) => m <= '2025-11').map((m) => gift('a@x.com', m));
  const rows = runThirteen(g).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reason, 'nothing-found');
  const pp = runThirteen(g.map((x) => ({ ...x, gateway: 'paypal' }))).rows;
  assert.equal(pp[0].reason, 'no-failure-data');
});

test('a donor who looks quarterly never gets paid-late or came-back', () => {
  const { rows } = runWide(gifts('a@x.com', ['2026-01', '2026-04', '2026-07']));
  assert.ok(rows.every((r) => r.reason === 'not-monthly'));
});

const reasonFor = (g: Gift[], month = '2025-12') => runThirteen(g).rows.find((r) => r.month === month)?.reason;

test('an equal-amount tie across gateways gives the same answer in either input order', () => {
  const plan = (before: Array<Partial<Gift>>) => monthGifts('a@x.com', { '2025-11': before, '2025-12': [], '2026-01': [{}, {}, {}] });
  const mollieFirst = plan([{ gateway: 'mollie' }, { gateway: 'paypal' }]);
  const paypalFirst = plan([{ gateway: 'paypal' }, { gateway: 'mollie' }]);
  assert.equal(reasonFor(mollieFirst), 'paid-late');
  assert.equal(reasonFor(paypalFirst), 'paid-late');
});

test('two catch-up gifts of different sizes are not a catch-up', () => {
  const g = monthGifts('a@x.com', { '2025-12': [], '2026-01': [{ amount: 10 }, { amount: 12 }] });
  assert.equal(reasonFor(g), 'came-back');
});

test('two live subscriptions on one gateway still beat paid-late', () => {
  const g = monthGifts('a@x.com', { '2025-12': [], '2026-01': [{}, {}] });
  const out = runThirteen(g, [], [
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'active' },
    { email: 'a@x.com', gateway: 'mollie', interval: 'monthly', status: 'pending' },
  ]);
  assert.equal(out.rows.find((r) => r.month === '2025-12')?.reason, 'two-subscriptions');
});

test('three gifts next month where only one matches the usual gift is came-back', () => {
  const g = monthGifts('a@x.com', { '2025-12': [], '2026-01': [{ amount: 10 }, { amount: 15 }, { amount: 20 }] });
  assert.equal(reasonFor(g), 'came-back');
});

test('the real February shape stays paid-late: one GoCardless gift before, two of the same amount after', () => {
  const g = [
    ...thirteen.filter((m) => m <= '2026-01').map((m) => gift('a@x.com', m, 'gocardless', { amount: 8 })),
    gift('a@x.com', '2026-03', 'gocardless', { amount: 8 }),
    gift('a@x.com', '2026-03', 'gocardless', { amount: 8 }),
  ];
  const wideMonths = [...thirteen, '2026-03'].slice(1);
  const out = reconcileMonths({ months: wideMonths, gifts: g, failures: [], subscriptions: [] });
  assert.equal(out.rows.find((r) => r.month === '2026-02')?.reason, 'paid-late');
});
