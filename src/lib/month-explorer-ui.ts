// Browser-side wiring for the dashboard's "Explore a month" section.
// Pure logic lives in ./month-explorer; this file only touches the DOM.
import {
  classifyStopped,
  confirmedCancellations,
  failedEmailSet,
  failedForMonth,
  fromFetched,
  monthLabel,
  type DonorRow,
  type FailedTx,
  type FetchedDonor,
  type StoppedRow,
  type StopReason,
} from './month-explorer';

interface ExplorerData {
  defaultMonth: string;
  currentMonth: string;
  failed: FailedTx[];
  monthlyFailed: Record<string, { count: number; amount: number }>;
  /** True counts per month (the embedded lists are capped by the weekly sync). */
  monthlyFlow: Record<string, { joined: number; churned: number }>;
  started: DonorRow[];
  stopped: StoppedRow[];
}

interface MonthPeople {
  started: DonorRow[];
  stopped: StoppedRow[];
}

const FETCH_TIMEOUT_MS = 75_000;

const REASON_CHIP: Record<StopReason, { label: string; cls: string }> = {
  failed: { label: 'Payment failed — fixable', cls: 'chip-warn' },
  cancelled: { label: 'Cancelled', cls: 'chip-bad' },
  no_charge: { label: 'No charge made', cls: 'chip-muted' },
};

const escapeHtml = (value: string): string =>
  (value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

function formatMoney(amount: number, currency = 'GBP'): string {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount || 0);
  } catch {
    return `£${(amount || 0).toFixed(2)}`;
  }
}

function formatDay(iso: string): string {
  const date = new Date(`${(iso || '').slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso || '—';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

const message = (text: string): string => `<div class="empty" style="padding:20px">${escapeHtml(text)}</div>`;

function table(headers: Array<{ label: string; num?: boolean }>, rows: string[]): string {
  const head = headers.map((h) => `<th scope="col"${h.num ? ' class="num"' : ''}>${escapeHtml(h.label)}</th>`).join('');
  return `<div class="table-wrap"><table class="data"><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
}

const gatewayCell = (gateway: string): string => `<td style="text-transform:capitalize">${escapeHtml(gateway)}</td>`;
const amountCell = (amount: number): string => `<td class="num">${amount ? formatMoney(amount) : '—'}</td>`;

function startedTable(rows: DonorRow[]): string {
  if (!rows.length) return message('Nobody new started giving this month.');
  return table(
    [{ label: 'Donor' }, { label: 'Provider' }, { label: 'Monthly gift', num: true }],
    rows.map((r) => `<tr class="row-new"><td>${escapeHtml(r.label)}</td>${gatewayCell(r.gateway)}${amountCell(r.amount)}</tr>`)
  );
}

function stoppedTable(rows: StoppedRow[]): string {
  if (!rows.length) return message('Nobody stopped giving this month.');
  return table(
    [{ label: 'Donor' }, { label: 'Provider' }, { label: 'Monthly gift', num: true }, { label: 'What happened' }],
    rows.map((r) => {
      const chip = REASON_CHIP[r.reason] ?? REASON_CHIP.no_charge;
      return `<tr class="row-lost"><td>${escapeHtml(r.label)}</td>${gatewayCell(r.gateway)}${amountCell(r.amount)}<td><span class="chip ${chip.cls}">${chip.label}</span></td></tr>`;
    })
  );
}

function cancelledTable(rows: StoppedRow[]): string {
  if (!rows.length) return message('No cancellations were reported by the payment providers this month. People who simply stopped paying are listed under “Who stopped giving”.');
  return table(
    [{ label: 'Donor' }, { label: 'Amount', num: true }, { label: 'Provider' }],
    rows.map((r) => `<tr><td style="color:var(--text-2)">${escapeHtml(r.label)}</td>${amountCell(r.amount)}${gatewayCell(r.gateway)}</tr>`)
  );
}

function failedTable(rows: FailedTx[]): string {
  return table(
    [{ label: 'Date' }, { label: 'Amount', num: true }, { label: 'Provider' }, { label: 'Donor' }],
    rows.map(
      (tx) =>
        `<tr><td>${escapeHtml(formatDay(tx.date))}</td><td class="num" style="color:var(--neg)">${formatMoney(tx.amount, tx.currency)}</td>${gatewayCell(tx.gateway)}<td style="color:var(--text-2)">${escapeHtml(tx.payer || '—')}</td></tr>`
    )
  );
}

function readToken(): string {
  return new URLSearchParams(window.location.search).get('token') || localStorage.getItem('admin_token') || '';
}

async function fetchMonthPeople(month: string, failedEmails: Set<string>): Promise<MonthPeople> {
  const token = readToken();
  const url = `/api/admin-donor-detail?month=${encodeURIComponent(month)}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    const data = (await res.json()) as { donors: Array<FetchedDonor & { isNew?: boolean }>; lost: FetchedDonor[] };
    return {
      started: fromFetched(data.donors.filter((d) => d.isNew)),
      stopped: classifyStopped(fromFetched(data.lost), failedEmails),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('This is taking too long. Try again in a minute — the next attempt is usually faster.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

export function initMonthExplorer(): void {
  const dataEl = document.getElementById('explorer-data');
  const root = document.getElementById('month-explorer');
  const select = document.getElementById('explorer-month') as HTMLSelectElement | null;
  const panel = (id: string) => document.getElementById(id);
  const summary = panel('explorer-summary');
  const started = panel('ex-started');
  const stopped = panel('ex-stopped');
  const cancelled = panel('ex-cancelled');
  const failedPanel = panel('ex-failed');
  if (!dataEl || !root || !select || !summary || !started || !stopped || !cancelled || !failedPanel) return;

  let data: ExplorerData;
  try {
    data = JSON.parse(dataEl.textContent || '{}') as ExplorerData;
  } catch {
    return;
  }

  const peopleCache = new Map<string, MonthPeople>();
  let selection = 0;

  const markSelected = (month: string) => {
    root.querySelectorAll<SVGElement>('.bar-hit').forEach((el) => {
      const selected = el.getAttribute('data-month') === month;
      el.classList.toggle('is-selected', selected);
      el.setAttribute('aria-pressed', String(selected));
    });
  };

  const showFailed = (month: string) => {
    const rows = failedForMonth(data.failed, month);
    const expected = data.monthlyFailed[month]?.count ?? 0;
    if (!rows.length) {
      failedPanel.innerHTML = expected > 0
        ? message(`This month had ${expected} failed payment${expected === 1 ? '' : 's'}, but the list was not saved by the last data refresh. Press “Refresh data” (top right) to load it.`)
        : message('No failed payments this month.');
      return;
    }
    const note =
      expected > rows.length
        ? `<div class="kpi-desc" style="margin-top:8px">Showing ${rows.length} of ${expected} failed payments. Press “Refresh data” to load the full list.</div>`
        : '';
    failedPanel.innerHTML = failedTable(rows) + note;
  };

  const showPeople = (month: string, people: MonthPeople) => {
    started.innerHTML = startedTable(people.started);
    stopped.innerHTML = stoppedTable(people.stopped);
    cancelled.innerHTML = cancelledTable(confirmedCancellations(people.stopped));
  };

  const showSummary = (month: string, people: MonthPeople | null) => {
    const failedInfo = data.monthlyFailed[month];
    const parts = [`${monthLabel(month)}`];
    if (failedInfo) parts.push(`${failedInfo.count} failed payment${failedInfo.count === 1 ? '' : 's'} (${formatMoney(failedInfo.amount)})`);
    if (people) {
      const flow = month === data.defaultMonth ? data.monthlyFlow[month] : undefined;
      parts.push(`${flow?.joined ?? people.started.length} started · ${flow?.churned ?? people.stopped.length} stopped`);
    }
    summary.textContent = parts.join(' — ');
  };

  const showPlaceholder = (text: string) => {
    [started, stopped, cancelled].forEach((el) => (el.innerHTML = message(text)));
  };

  const loadPeople = async (month: string, failedEmails: Set<string>, mine: number): Promise<void> => {
    const cached = peopleCache.get(month);
    if (cached) {
      showPeople(month, cached);
      showSummary(month, cached);
      return;
    }
    showPlaceholder('Loading… this reads live from Mollie, GoCardless and PayPal and can take up to a minute.');
    try {
      const people = await fetchMonthPeople(month, failedEmails);
      peopleCache.set(month, people);
      if (mine !== selection) return; // user moved on to another month
      showPeople(month, people);
      showSummary(month, people);
    } catch (err) {
      if (mine !== selection) return;
      const reason = err instanceof Error ? err.message : 'error';
      [started, stopped, cancelled].forEach((el) => {
        el.innerHTML = `${message(`Could not load this month: ${reason}`)}<div style="padding:0 20px 16px"><button type="button" class="btn btn-ghost" data-retry>Try again</button></div>`;
      });
    }
  };

  const show = (month: string): void => {
    selection += 1;
    const mine = selection;
    markSelected(month);
    showFailed(month);
    showSummary(month, null);

    if (month === data.currentMonth) {
      showPlaceholder('This month is still in progress, so “started” and “stopped” would be misleading. Pick a full month to see them.');
      return;
    }
    const failedEmails = failedEmailSet(data.failed, month);
    if (month === data.defaultMonth) {
      const people: MonthPeople = { started: data.started, stopped: classifyStopped(data.stopped, failedEmails) };
      showPeople(month, people);
      const flow = data.monthlyFlow[month];
      if (flow) {
        const capNote = (shown: number, total: number) =>
          total > shown ? `<div class="kpi-desc" style="margin-top:8px">Showing ${shown} of ${total}. Pick another month and come back for the full list.</div>` : '';
        started.insertAdjacentHTML('beforeend', capNote(people.started.length, flow.joined));
        stopped.insertAdjacentHTML('beforeend', capNote(people.stopped.length, flow.churned));
      }
      showSummary(month, people);
      return;
    }
    void loadPeople(month, failedEmails, mine);
  };

  const choose = (month: string) => {
    if (!month || !Array.from(select.options).some((o) => o.value === month)) return;
    select.value = month;
    show(month);
  };

  select.addEventListener('change', () => choose(select.value));

  root.addEventListener('click', (event) => {
    const target = event.target as Element | null;
    const hit = target?.closest('.bar-hit');
    if (hit) return choose(hit.getAttribute('data-month') || '');
    if (target?.closest('[data-retry]')) choose(select.value);
  });

  root.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const hit = (event.target as Element | null)?.closest('.bar-hit');
    if (!hit) return;
    event.preventDefault();
    choose(hit.getAttribute('data-month') || '');
  });

  show(select.value || data.defaultMonth);
}
