// "Lost donors across months": turns each donor's list of months-with-a-gift
// into a month-by-month timeline, so repeat losses and comebacks are visible.
// Pure functions only (no DOM, no network) so they are easy to test.

export interface LostDonorInput {
  key: string;
  label: string;
  email?: string;
  gateway: string;
  amount: number;
  /** Months ('YYYY-MM') in which this donor gave a monthly gift. */
  present: string[];
}

export interface LostResponse {
  /**
   * Chronological months. The first one is only context: it is needed to tell
   * whether someone was lost in the second, so it never appears as a column.
   */
  months: string[];
  donors: LostDonorInput[];
  /** Lower-cased emails that had a failed charge, per month. */
  failedEmails: Record<string, string[]>;
}

export type CellState = 'before' | 'gave' | 'lost-failed' | 'lost-no-charge' | 'away';

export interface LostRow {
  key: string;
  label: string;
  email?: string;
  gateway: string;
  amount: number;
  cells: Record<string, CellState>;
  timesLost: number;
  lostMonths: string[];
  /** Gave again at least once after a loss. */
  returned: boolean;
  /** Not giving in the latest month. */
  stillAway: boolean;
}

export interface LostSummary {
  uniqueLost: number;
  lostEvents: number;
  repeaters: number;
  returned: number;
  stillAway: number;
  /** Losses followed by a gift within the next two months... */
  returnedWithin2Months: number;
  /** ...out of the losses that have at least two later months of data. */
  eligibleEvents: number;
  byMonth: Array<{ month: string; lost: number }>;
}

export interface LostMatrix {
  months: string[];
  rows: LostRow[];
  summary: LostSummary;
}

const QUICK_RETURN_MONTHS = 2;

function buildRow(donor: LostDonorInput, months: string[], failed: Record<string, Set<string>>): LostRow | null {
  const present = new Set(donor.present);
  const email = (donor.email || '').toLowerCase();
  const cells: Record<string, CellState> = {};
  const lostMonths: string[] = [];
  let seenEarlier = present.has(months[0]);

  for (let i = 1; i < months.length; i++) {
    const month = months[i];
    if (present.has(month)) {
      cells[month] = 'gave';
      seenEarlier = true;
    } else if (present.has(months[i - 1])) {
      cells[month] = email && failed[month]?.has(email) ? 'lost-failed' : 'lost-no-charge';
      lostMonths.push(month);
    } else {
      cells[month] = seenEarlier ? 'away' : 'before';
    }
  }

  if (!lostMonths.length) return null;

  const lastMonth = months[months.length - 1];
  const firstLostIndex = months.indexOf(lostMonths[0]);
  const returned = months.slice(firstLostIndex + 1).some((m) => present.has(m));

  return {
    key: donor.key,
    label: donor.label,
    email: donor.email,
    gateway: donor.gateway,
    amount: donor.amount,
    cells,
    timesLost: lostMonths.length,
    lostMonths,
    returned,
    stillAway: !present.has(lastMonth),
  };
}

function summarise(rows: LostRow[], months: string[], donors: Map<string, Set<string>>): LostSummary {
  const lastIndex = months.length - 1;
  let returnedWithin2Months = 0;
  let eligibleEvents = 0;

  for (const row of rows) {
    const gave = donors.get(row.key) ?? new Set<string>();
    for (const lostMonth of row.lostMonths) {
      const index = months.indexOf(lostMonth);
      if (index + QUICK_RETURN_MONTHS > lastIndex) continue;
      eligibleEvents += 1;
      const back = months.slice(index + 1, index + 1 + QUICK_RETURN_MONTHS).some((m) => gave.has(m));
      if (back) returnedWithin2Months += 1;
    }
  }

  return {
    uniqueLost: rows.length,
    lostEvents: rows.reduce((sum, r) => sum + r.timesLost, 0),
    repeaters: rows.filter((r) => r.timesLost >= 2).length,
    returned: rows.filter((r) => r.returned).length,
    stillAway: rows.filter((r) => r.stillAway).length,
    returnedWithin2Months,
    eligibleEvents,
    byMonth: months.slice(1).map((month) => ({
      month,
      lost: rows.filter((r) => r.lostMonths.includes(month)).length,
    })),
  };
}

const mostRecentLoss = (row: LostRow): string => row.lostMonths[row.lostMonths.length - 1] || '';

/** Builds the month-by-month picture of everyone who stopped giving at least once. */
export function buildLostMatrix(response: LostResponse): LostMatrix {
  const { months, donors, failedEmails } = response;
  const failed: Record<string, Set<string>> = Object.fromEntries(
    Object.entries(failedEmails || {}).map(([month, emails]) => [month, new Set(emails.map((e) => e.toLowerCase()))])
  );

  const rows = donors
    .map((donor) => buildRow(donor, months, failed))
    .filter((row): row is LostRow => row !== null)
    .sort(
      (a, b) =>
        b.timesLost - a.timesLost ||
        mostRecentLoss(b).localeCompare(mostRecentLoss(a)) ||
        a.label.localeCompare(b.label)
    );

  const gaveByKey = new Map(donors.map((d) => [d.key, new Set(d.present)]));
  return { months: months.slice(1), rows, summary: summarise(rows, months, gaveByKey) };
}
