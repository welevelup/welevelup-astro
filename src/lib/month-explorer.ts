// Pure helpers behind the dashboard's "Explore a month" panels.
// No DOM, no network: everything here is a plain function so it can be tested.

export interface FailedTx {
  date: string;
  amount: number;
  currency: string;
  gateway: string;
  payer: string;
}

export type StopReason = 'failed' | 'cancelled' | 'no_charge';

/** One donor row, whichever source it came from (cached summary or live lookup). */
export interface DonorRow {
  label: string;
  email?: string;
  gateway: string;
  amount: number;
  reason?: StopReason;
}

export interface StoppedRow extends DonorRow {
  reason: StopReason;
}

/** Shape returned by /api/admin-donor-detail. */
export interface FetchedDonor {
  name?: string;
  email?: string;
  gateway: string;
  amount: number;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function monthOf(iso: string): string {
  return (iso || '').slice(0, 7);
}

/** 'YYYY-MM' -> 'Oct 2026'. Anything else is returned untouched. */
export function monthLabel(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '');
  if (!match) return month;
  const name = MONTH_NAMES[parseInt(match[2], 10) - 1];
  return name ? `${name} ${match[1]}` : month;
}

/** Failed charges that happened in `month`, newest first. Does not mutate the input. */
export function failedForMonth(list: FailedTx[], month: string): FailedTx[] {
  return list
    .filter((tx) => monthOf(tx.date) === month)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Lower-cased payer emails with a failed charge in `month` (non-email payers are skipped). */
export function failedEmailSet(list: FailedTx[], month: string): Set<string> {
  const emails = failedForMonth(list, month)
    .map((tx) => (tx.payer || '').trim().toLowerCase())
    .filter((payer) => payer.includes('@'));
  return new Set(emails);
}

/**
 * Tags each donor who stopped giving. A reason that is already known (from the
 * weekly sync) is kept; otherwise a failed charge that month means "fixable",
 * and anything else is "no charge made".
 */
export function classifyStopped(lost: DonorRow[], failedEmails: Set<string>): StoppedRow[] {
  return lost.map((donor) => {
    if (donor.reason) return { ...donor, reason: donor.reason };
    const email = (donor.email || '').toLowerCase();
    const reason: StopReason = email && failedEmails.has(email) ? 'failed' : 'no_charge';
    return { ...donor, reason };
  });
}

/** The last `count` months of a chronological list, newest first. */
export function recentMonths(rows: Array<{ month: string }>, count: number): string[] {
  return rows
    .map((row) => monthOf(row.month))
    .slice(-count)
    .reverse();
}

/** Live-lookup donors -> the common row shape (name, else email, else "unknown"). */
export function fromFetched(donors: FetchedDonor[]): DonorRow[] {
  return donors.map((donor) => {
    const name = (donor.name || '').trim();
    const hasRealName = name && name.toLowerCase() !== 'unknown';
    return {
      label: hasRealName ? name : donor.email || 'unknown',
      email: donor.email || undefined,
      gateway: donor.gateway,
      amount: donor.amount,
    };
  });
}
