// "Reconcile months": for every month, explains WHY each donor looks lost
// (gave the month before, not this month) across Mollie, GoCardless and PayPal.
// Pure: no DOM, no network. The "lost" rule is the same as src/lib/lost-donors.ts.

/** 'other' is anything not clearly slower than monthly (weekly, daily, odd intervals): it behaves like monthly. */
export type Interval = 'monthly' | 'quarterly' | 'half-yearly' | 'yearly' | 'other' | 'unknown';
export type Reason = 'failed-charge' | 'not-monthly' | 'two-subscriptions' | 'no-failure-data' | 'nothing-found';

export const REASONS: readonly Reason[] = ['failed-charge', 'not-monthly', 'two-subscriptions', 'no-failure-data', 'nothing-found'];

export interface Gift { month: string; name: string; email: string; amount: number; gateway: string }
export interface Failure { month: string; email: string; gateway: string }
export interface Subscription { email: string; gateway: string; interval: Interval; status: string }

export interface ReconcileInput {
  /** Oldest first. The first month is context only, as in lost-donors.ts. */
  months: string[];
  gifts: readonly Gift[];
  failures: readonly Failure[];
  subscriptions?: readonly Subscription[];
}

export interface ReconcileRow {
  month: string;
  label: string;
  email: string;
  gateway: string;
  amount: number;
  reason: Reason;
  evidence: string;
}

export interface MonthReasonCounts { month: string; total: number; counts: Record<Reason, number> }

export interface ReconcileSummary {
  totalLost: number;
  counts: Record<Reason, number>;
  /** failed-charge + nothing-found. */
  reallyLost: number;
  /** not-monthly + two-subscriptions. */
  falseAlarm: number;
  /** no-failure-data. */
  unknown: number;
  line: string;
}

export interface ReconcileResult {
  months: string[];
  rows: ReconcileRow[];
  byMonth: MonthReasonCounts[];
  summary: ReconcileSummary;
}

interface Donor { key: string; label: string; email: string; gateway: string; amount: number; lastMonth: string; present: Set<string> }

const emptyCounts = (): Record<Reason, number> => ({
  'failed-charge': 0, 'not-monthly': 0, 'two-subscriptions': 0, 'no-failure-data': 0, 'nothing-found': 0,
});

const monthIndex = (month: string): number => {
  const [y, m] = month.split('-').map(Number);
  return y * 12 + (m - 1);
};

const SLOW_INTERVAL_TEXT: Partial<Record<Interval, string>> = {
  quarterly: 'every 3 months', 'half-yearly': 'every 6 months', yearly: 'once a year',
};

const GATEWAY_NAME: Record<string, string> = { mollie: 'Mollie', gocardless: 'GoCardless', paypal: 'PayPal' };
const gatewayName = (gateway: string): string => GATEWAY_NAME[gateway] ?? gateway;

/** Only a live subscription says how the donor pays today. */
const isLive = (s: Subscription): boolean => s.status === 'active' || s.status === 'pending';
const isCancelled = (s: Subscription): boolean => s.status === 'canceled' || s.status === 'cancelled';

function groupDonors(gifts: readonly Gift[], months: string[]): Map<string, Donor> {
  const inWindow = new Set(months);
  const donors = new Map<string, Donor>();
  for (const g of gifts) {
    if (!inWindow.has(g.month)) continue;
    const email = (g.email || '').toLowerCase();
    const realName = g.name && g.name.toLowerCase() !== 'unknown' ? g.name : '';
    const key = email || realName.toLowerCase();
    if (!key) continue; // cannot tell who this was: do not merge strangers
    const existing = donors.get(key);
    const donor: Donor = existing ?? {
      key, label: realName || email, email, gateway: g.gateway, amount: g.amount, lastMonth: g.month, present: new Set<string>(),
    };
    donor.present.add(g.month);
    if (g.month >= donor.lastMonth) Object.assign(donor, { lastMonth: g.month, gateway: g.gateway, amount: g.amount });
    if (realName && !donor.label.includes(' ') && realName.includes(' ')) donor.label = realName;
    donors.set(key, donor);
  }
  return donors;
}

/**
 * Inferred quarterly giving: at least 3 gift months, every gap exactly 3 months, and no
 * failed charge in the months between (a failure means a monthly donor who stopped paying).
 */
function looksQuarterly(donor: Donor, failuresByMonth: Map<string, Map<string, string>>): boolean {
  const sorted = Array.from(donor.present).sort();
  if (sorted.length < 3) return false;
  const indexes = sorted.map(monthIndex);
  const gaps = indexes.slice(1).map((v, i) => v - indexes[i]);
  if (!gaps.every((g) => g === 3)) return false;
  for (let i = indexes[0]; i <= indexes[indexes.length - 1]; i++) {
    if (donor.email && failuresByMonth.get(monthFromIndex(i))?.has(donor.email)) return false;
  }
  return true;
}

const monthFromIndex = (i: number): string => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`;

function classify(
  donor: Donor,
  month: string,
  previous: string,
  failuresByMonth: Map<string, Map<string, string>>,
  subs: readonly Subscription[]
): { reason: Reason; evidence: string } {
  const failedOn = donor.email ? failuresByMonth.get(month)?.get(donor.email) : undefined;
  if (failedOn) return { reason: 'failed-charge', evidence: `A ${gatewayName(failedOn)} charge failed in ${month}.` };

  const live = subs.filter(isLive);
  const liveKnown = live.filter((s) => s.interval !== 'unknown');
  const slow = liveKnown.find((s) => SLOW_INTERVAL_TEXT[s.interval]);
  const paysMonthlyToo = liveKnown.some((s) => !SLOW_INTERVAL_TEXT[s.interval]);
  if (slow && !paysMonthlyToo) {
    return { reason: 'not-monthly', evidence: `Their subscription pays ${SLOW_INTERVAL_TEXT[slow.interval]}, so ${month} is not a payment month.` };
  }
  if (!liveKnown.length && !subs.some(isCancelled) && looksQuarterly(donor, failuresByMonth)) {
    return {
      reason: 'not-monthly',
      evidence: `Inferred, not confirmed: they gave every 3 months (${Array.from(donor.present).sort().join(', ')}), so ${month} is probably not a payment month.`,
    };
  }

  const liveByGateway = new Map<string, number>();
  for (const s of live) liveByGateway.set(s.gateway, (liveByGateway.get(s.gateway) ?? 0) + 1);
  const doubled = Array.from(liveByGateway.entries()).find(([, n]) => n >= 2);
  if (doubled) return { reason: 'two-subscriptions', evidence: `Has ${doubled[1]} live subscriptions on ${gatewayName(doubled[0])}, so one may have replaced the other.` };

  if (donor.gateway === 'paypal') {
    return { reason: 'no-failure-data', evidence: 'PayPal gives no failure data, so we cannot tell why they stopped.' };
  }
  const cancelled = subs.find(isCancelled);
  const note = cancelled ? ` Their ${gatewayName(cancelled.gateway)} subscription was cancelled.` : '';
  return { reason: 'nothing-found', evidence: `Gave in ${previous}, then no gift and no failed charge in ${month}.${note}` };
}

export function reconcileMonths(input: ReconcileInput): ReconcileResult {
  const { months, gifts, failures } = input;
  const donors = groupDonors(gifts, months);

  const failuresByMonth = new Map<string, Map<string, string>>();
  for (const f of failures) {
    const email = (f.email || '').toLowerCase();
    if (!email) continue;
    const forMonth = new Map(failuresByMonth.get(f.month) ?? []);
    forMonth.set(email, f.gateway);
    failuresByMonth.set(f.month, forMonth);
  }

  const subsByEmail = new Map<string, Subscription[]>();
  for (const s of input.subscriptions ?? []) {
    const email = (s.email || '').toLowerCase();
    if (email) subsByEmail.set(email, [...(subsByEmail.get(email) ?? []), s]);
  }

  const rows: ReconcileRow[] = [];
  for (const donor of donors.values()) {
    const subs = donor.email ? subsByEmail.get(donor.email) ?? [] : [];
    for (let i = 1; i < months.length; i++) {
      if (donor.present.has(months[i]) || !donor.present.has(months[i - 1])) continue;
      const { reason, evidence } = classify(donor, months[i], months[i - 1], failuresByMonth, subs);
      rows.push({ month: months[i], label: donor.label, email: donor.email, gateway: donor.gateway, amount: donor.amount, reason, evidence });
    }
  }
  rows.sort((a, b) => a.month.localeCompare(b.month) || a.label.localeCompare(b.label));

  const byMonth: MonthReasonCounts[] = months.slice(1).map((month) => {
    const counts = emptyCounts();
    const inMonth = rows.filter((r) => r.month === month);
    for (const r of inMonth) counts[r.reason] += 1;
    return { month, total: inMonth.length, counts };
  });

  const counts = emptyCounts();
  for (const r of rows) counts[r.reason] += 1;
  const reallyLost = counts['failed-charge'] + counts['nothing-found'];
  const falseAlarm = counts['not-monthly'] + counts['two-subscriptions'];
  const unknown = counts['no-failure-data'];
  const totalLost = rows.length;
  const line = `Of ${totalLost} lost donor-months, ${reallyLost} look really lost, ${falseAlarm} are false alarms, and ${unknown} cannot be told (PayPal gives no failure data).`;

  return { months: months.slice(1), rows, byMonth, summary: { totalLost, counts, reallyLost, falseAlarm, unknown, line } };
}
