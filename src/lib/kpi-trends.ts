// Month-by-month series behind the dashboard's clickable KPI cards.
// Pure functions only, so they can be unit tested without Astro.

export interface MonthlyRow {
  month: string;
  total: number;
  monthly_donations: number;
  active_subscribers: number;
}

export interface FlowRow {
  month: string;
  joined: number;
  churned: number;
}

export interface KpiPoint {
  month: string;
  value: number;
}

export interface KpiTrend {
  key: 'raised' | 'donors' | 'income' | 'joined' | 'lost';
  title: string;
  description: string;
  /** Values are pounds (true) or plain counts (false). */
  money: boolean;
  points: KpiPoint[];
  note?: string;
}

const MAX_MONTHS = 12;

const lastMonths = <T>(rows: T[]): T[] => rows.slice(-MAX_MONTHS);

/**
 * Builds the five metrics that have a real monthly history. Metrics with no data
 * are left out, so a card is only clickable when there is something to show.
 * "Active donors" ignores the in-progress month (most donors simply haven't been
 * billed yet), matching how the card itself is counted.
 */
export function buildKpiTrends(monthly: MonthlyRow[], flows: FlowRow[]): KpiTrend[] {
  const completeMonths = monthly.slice(0, -1);

  const candidates: KpiTrend[] = [
    {
      key: 'raised',
      title: 'Raised per month',
      description: 'Everything received each month: monthly gifts plus one-off donations.',
      money: true,
      note: 'The latest month is still in progress, so its bar is only the money received so far.',
      points: lastMonths(monthly).map((m) => ({ month: m.month, value: m.total || 0 })),
    },
    {
      key: 'donors',
      title: 'Active monthly donors',
      description: 'People who gave monthly, for each complete month.',
      money: false,
      points: lastMonths(completeMonths).map((m) => ({ month: m.month, value: m.active_subscribers || 0 })),
    },
    {
      key: 'income',
      title: 'Monthly (recurring) income',
      description: 'What monthly donors actually gave each month. This is the real history behind “Expected monthly income”, which is today’s snapshot.',
      money: true,
      note: 'The latest month is still in progress, so its bar is only what has been received so far.',
      points: lastMonths(monthly).map((m) => ({ month: m.month, value: m.monthly_donations || 0 })),
    },
    {
      key: 'joined',
      title: 'New monthly donors',
      description: 'People who gave monthly for the first time, for each complete month.',
      money: false,
      points: lastMonths(flows).map((f) => ({ month: f.month, value: f.joined || 0 })),
    },
    {
      key: 'lost',
      title: 'Lost monthly donors',
      description: 'People who gave the month before but not this one, for each complete month.',
      money: false,
      points: lastMonths(flows).map((f) => ({ month: f.month, value: f.churned || 0 })),
    },
  ];

  return candidates.filter((trend) => trend.points.length > 0);
}
