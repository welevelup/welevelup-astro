// "Reconcile months": for every month, explains WHY each donor looks lost
// (gave the month before, not this month) across Mollie, GoCardless and PayPal.
// Pure: no DOM, no network. The "lost" rule is the same as src/lib/lost-donors.ts.

export type Interval = 'monthly' | 'quarterly' | 'yearly' | 'other' | 'unknown';
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

const INTERVAL_TEXT: Record<Exclude<Interval, 'monthly' | 'unknown'>, string> = {
  quarterly: 'every 3 months', yearly: 'once a year', other: 'on a schedule that is not monthly',
};

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

/** Gaps (in months) between a donor's gift months when they are all the same 3 or 12. */
function regularSpacing(present: Set<string>): 3 | 12 | null {
  const sorted = Array.from(present).map(monthIndex).sort((a, b) => a - b);
  if (sorted.length < 2) return null;
  const gaps = sorted.slice(1).map((v, i) => v - sorted[i]);
  const first = gaps[0];
  if ((first === 3 || first === 12) && gaps.every((g) => g === first)) return first;
  return null;
}

function classify(
  donor: Donor,
  month: string,
  previous: string,
  failuresByMonth: Map<string, Map<string, string>>,
  subs: readonly Subscription[]
): { reason: Reason; evidence: string } {
  const failedOn = donor.email ? failuresByMonth.get(month)?.get(donor.email) : undefined;
  if (failedOn) return { reason: 'failed-charge', evidence: `A charge on ${failedOn} failed in ${month}.` };

  const known = subs.filter((s) => s.interval !== 'unknown');
  const nonMonthly = known.find((s) => s.interval !== 'monthly');
  if (nonMonthly && !known.some((s) => s.interval === 'monthly')) {
    return { reason: 'not-monthly', evidence: `Their subscription pays ${intervalText(nonMonthly.interval)}, so ${month} is not a payment month.` };
  }
  if (!known.length) {
    const spacing = regularSpacing(donor.present);
    if (spacing) {
      return {
        reason: 'not-monthly',
        evidence: `They gave ${spacing === 3 ? 'every 3 months' : 'once a year'} (${Array.from(donor.present).sort().join(', ')}), so ${month} is not a payment month.`,
      };
    }
  }

  const perGateway = new Map<string, number>();
  for (const s of subs) perGateway.set(s.gateway, (perGateway.get(s.gateway) ?? 0) + 1);
  const doubled = Array.from(perGateway.entries()).find(([, n]) => n >= 2);
  if (doubled) return { reason: 'two-subscriptions', evidence: `Has ${doubled[1]} subscriptions on ${doubled[0]}, so one may have replaced the other.` };

  if (donor.gateway === 'paypal') {
    return { reason: 'no-failure-data', evidence: 'PayPal gives no failure data, so we cannot tell why they stopped.' };
  }
  return { reason: 'nothing-found', evidence: `Gave in ${previous}, then no gift and no failed charge in ${month}.` };
}

function intervalText(interval: Interval): string {
  return interval === 'monthly' || interval === 'unknown' ? '' : INTERVAL_TEXT[interval];
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
