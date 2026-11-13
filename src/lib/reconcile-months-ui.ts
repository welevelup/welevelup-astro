// Browser wiring for "Reconcile months" on the Payments guide. The rules live in
// ./reconcile-months; this file fetches and draws, with DOM methods and
// textContent only (donor names and emails never go through innerHTML).
import { REASONS, reconcileMonths, type Gift, type Failure, type Reason, type ReconcileResult, type ReconcileRow, type Subscription } from './reconcile-months';
import { monthLabel } from './month-explorer';

const FETCH_TIMEOUT_MS = 65_000;
const MAX_MONTHS = 12;
const FIRST_MONTH = '2026-01';
const MONTH_CHOICES = 24;

interface ReconcileResponse {
  months: string[];
  gifts: Gift[];
  failures: Failure[];
  subscriptions: Subscription[];
  truncated: boolean;
  lookupErrors: number;
  gatewayErrors: Array<{ gateway: string; problem: string }>;
}

const REASON_TEXT: Record<Reason, string> = {
  'failed-charge': 'Failed charge',
  'not-monthly': 'Pays every 3 months or less often (not really lost)',
  'two-subscriptions': 'Two subscriptions',
  'paid-late': 'Paid late (collected the next month)',
  'came-back': 'Missed one payment, donor came back',
  'no-failure-data': 'PayPal gives no failure data',
  'nothing-found': 'Nothing found (really lost)',
};

const REASON_CHIP: Record<Reason, string> = {
  'failed-charge': 'chip-bad',
  'not-monthly': 'chip-good',
  'two-subscriptions': 'chip-good',
  'paid-late': 'chip-good',
  'came-back': 'chip-warn',
  'no-failure-data': 'chip-warn',
  'nothing-found': 'chip-bad',
};

const monthKey = (year: number, monthIndex: number): string => {
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/** Newest first, ending at the last complete month. */
function monthChoices(): string[] {
  const now = new Date();
  return Array.from({ length: MONTH_CHOICES }, (_, i) => monthKey(now.getUTCFullYear(), now.getUTCMonth() - 1 - i));
}

const monthSpan = (from: string, to: string): number => {
  const idx = (m: string) => { const [y, mo] = m.split('-').map(Number); return y * 12 + mo - 1; };
  return idx(to) - idx(from) + 1;
};

function readToken(): string {
  return new URLSearchParams(window.location.search).get('token') || localStorage.getItem('admin_token') || '';
}

async function load(from: string, to: string): Promise<ReconcileResponse> {
  const params = new URLSearchParams({ from, to });
  const token = readToken();
  if (token) params.set('token', token);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`/api/admin-reconcile-months?${params}`, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('This is taking too long. Try a shorter range of months.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

// ── rendering (DOM methods only) ────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function headCell(label: string, className?: string): HTMLTableCellElement {
  const th = el('th', label, className);
  th.scope = 'col';
  return th;
}

function cell(text: string, className?: string): HTMLTableCellElement {
  return el('td', text, className);
}

function tableOf(label: string, head: HTMLElement[], rows: HTMLTableRowElement[]): HTMLElement {
  const wrap = el('div', undefined, 'table-wrap');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', label);
  const table = el('table', undefined, 'data reconcile-table');
  const headRow = el('tr');
  headRow.append(...head);
  const thead = el('thead');
  thead.append(headRow);
  const tbody = el('tbody');
  tbody.append(...rows);
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

function headline(result: ReconcileResult, partial: boolean): HTMLElement {
  const s = result.summary;
  const box = el('div', undefined, 'reconcile-headline');
  const text = partial
    ? `Partial data: a payment provider is missing, so do not rely on these numbers. ${s.line}`
    : s.line;
  box.append(el('p', text, partial ? 'reconcile-line reconcile-partial' : 'reconcile-line'));
  const suffix = partial ? ' (partial data)' : '';
  const stats = el('div', undefined, 'kpi-grid');
  [
    [`Really lost${suffix}`, s.reallyLost, 'Failed charge, or nothing found.'],
    [`False alarm${suffix}`, s.falseAlarm, 'Pays less often than monthly, has two live subscriptions, or paid late.'],
    [`Missed one payment, donor came back${suffix}`, s.missedButReturned, 'The payment was not recovered, but they kept giving.'],
    [`Cannot be told${suffix}`, s.unknown, 'PayPal donors: no failure data.'],
  ].forEach(([label, value, hint]) => {
    const kpi = el('div', undefined, 'kpi');
    kpi.append(el('div', String(label), 'kpi-label'), el('div', String(value), 'kpi-value'), el('div', String(hint), 'kpi-desc'));
    stats.append(kpi);
  });
  box.append(stats);
  return box;
}

function summaryTable(result: ReconcileResult): HTMLElement {
  const head = [headCell('Month'), ...REASONS.map((r) => headCell(REASON_TEXT[r], 'num')), headCell('Total lost', 'num')];
  const rows = result.byMonth.map((m) => {
    const tr = el('tr');
    tr.append(cell(monthLabel(m.month)), ...REASONS.map((r) => cell(String(m.counts[r]), 'num')), cell(String(m.total), 'num'));
    return tr;
  });
  const total = el('tr', undefined, 'reconcile-total');
  total.append(cell('All months'), ...REASONS.map((r) => cell(String(result.summary.counts[r]), 'num')), cell(String(result.summary.totalLost), 'num'));
  return tableOf('Lost donors by month and reason', head, [...rows, total]);
}

function detailRow(row: ReconcileRow): HTMLTableRowElement {
  const tr = el('tr');
  const donor = el('td');
  donor.append(el('div', row.label));
  if (row.email && row.email !== row.label) donor.append(el('div', row.email, 'kpi-desc'));
  const reason = el('td');
  reason.append(el('span', REASON_TEXT[row.reason], `chip ${REASON_CHIP[row.reason]}`));
  tr.append(
    cell(monthLabel(row.month)),
    donor,
    cell(row.gateway, 'reconcile-gateway'),
    cell(row.amount ? `£${row.amount.toFixed(2)}` : '—', 'num'),
    reason,
    cell(row.evidence, 'reconcile-evidence')
  );
  return tr;
}

function detailTable(rows: ReconcileRow[]): HTMLElement {
  if (!rows.length) return el('div', 'Nobody was lost in this month.', 'empty');
  const head = [headCell('Month'), headCell('Donor'), headCell('Provider'), headCell('Gift', 'num'), headCell('Why'), headCell('What we found')];
  return tableOf('Every lost donor-month and the reason', head, rows.map(detailRow));
}

function warnings(data: ReconcileResponse): string[] {
  const out: string[] = [];
  for (const g of data.gatewayErrors) {
    const why = g.problem === 'not configured' ? 'is not set up here' : g.problem === 'timed out' ? 'took too long (try fewer months)' : 'could not be read';
    out.push(`${g.gateway} ${why}, so its donors are missing from this picture.`);
  }
  if (data.truncated) out.push('Some gateway had more payments than we read, so older ones may be missing. Try fewer months.');
  if (data.lookupErrors > 0) out.push(`${data.lookupErrors} donor or subscription lookup${data.lookupErrors === 1 ? '' : 's'} failed, so some reasons may say "Nothing found". Try again.`);
  return out;
}

// ── wiring ──────────────────────────────────────────────────────────────

function fillSelect(select: HTMLSelectElement, values: string[], selected: string): void {
  select.replaceChildren(...values.map((v) => {
    const option = el('option', monthLabel(v));
    option.value = v;
    option.selected = v === selected;
    return option;
  }));
}

export function initReconcileMonths(): void {
  const fromSelect = document.getElementById('reconcile-from') as HTMLSelectElement | null;
  const toSelect = document.getElementById('reconcile-to') as HTMLSelectElement | null;
  const button = document.getElementById('reconcile-load') as HTMLButtonElement | null;
  const status = document.getElementById('reconcile-status');
  const results = document.getElementById('reconcile-results');
  if (!fromSelect || !toSelect || !button || !status || !results) return;

  const choices = monthChoices();
  const defaultTo = choices[0];
  const oldestFirst = [...choices].reverse();
  const defaultFrom = oldestFirst.includes(FIRST_MONTH) && monthSpan(FIRST_MONTH, defaultTo) <= MAX_MONTHS
    ? FIRST_MONTH
    : choices[Math.min(MAX_MONTHS, choices.length) - 1];
  fillSelect(fromSelect, oldestFirst, defaultFrom);
  fillSelect(toSelect, oldestFirst, defaultTo);

  let result: ReconcileResult | null = null;

  const drawDetail = (month: string) => {
    const holder = document.getElementById('reconcile-detail');
    if (!holder || !result) return;
    const rows = month ? result.rows.filter((r) => r.month === month) : result.rows;
    holder.replaceChildren(detailTable(rows));
  };

  const render = (data: ReconcileResponse) => {
    if (!result) return;
    const filterLabel = el('label', 'Show month ');
    filterLabel.htmlFor = 'reconcile-month-filter';
    const filter = el('select');
    filter.id = 'reconcile-month-filter';
    const all = el('option', 'All months');
    all.value = '';
    filter.append(all, ...result.months.map((m) => { const o = el('option', monthLabel(m)); o.value = m; return o; }));
    filter.addEventListener('change', () => drawDetail(filter.value));
    filterLabel.append(filter);
    const controls = el('div', undefined, 'reconcile-controls');
    controls.append(filterLabel);
    const detail = el('div');
    detail.id = 'reconcile-detail';

    const notes = warnings(data).map((w) => el('p', w, 'callout reconcile-warning'));
    results.replaceChildren(...notes, headline(result, data.gatewayErrors.length > 0), summaryTable(result), el('h3', 'Every lost donor-month', 'reconcile-sub'), controls, detail);
    drawDetail('');
  };

  button.addEventListener('click', async () => {
    const from = fromSelect.value;
    const to = toSelect.value;
    if (from > to) { status.textContent = 'The first month must not be after the last month.'; return; }
    if (monthSpan(from, to) > MAX_MONTHS) { status.textContent = `Choose at most ${MAX_MONTHS} months.`; return; }
    button.disabled = true;
    status.textContent = 'Loading… this reads Mollie, GoCardless and PayPal and can take up to a minute.';
    try {
      const data = await load(from, to);
      result = reconcileMonths({ months: data.months, gifts: data.gifts, failures: data.failures, subscriptions: data.subscriptions });
      status.textContent = `${monthLabel(result.months[0])} to ${monthLabel(result.months[result.months.length - 1])}.`;
      button.textContent = 'Reload';
      render(data);
    } catch (err) {
      status.textContent = `Could not load: ${err instanceof Error ? err.message : 'error'}`;
    } finally {
      button.disabled = false;
    }
  });
}
