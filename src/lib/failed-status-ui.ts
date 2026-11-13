// Browser wiring for "What are these failed payments?" on the Donations tab.
// The rules live in ./failed-status; this file only fetches and draws, with DOM
// methods and textContent (donor names and emails are never put into innerHTML).
import {
  buildFailedStatus, type EmailStatus, type FailedPaymentInput, type FailedStatusResult, type FailedStatusRow, type FixedStatus,
} from './failed-status';

const FETCH_TIMEOUT_MS = 65_000;

interface FailedStatusResponse {
  now: string;
  remindersEnabled: boolean;
  payments: FailedPaymentInput[];
  paidTimesByCustomer: Record<string, string[]>;
  sentStages: string[];
  cancelledCustomerIds: string[];
}

const EMAIL_TEXT: Record<EmailStatus, { text: string; cls: string }> = {
  'sent-day-3': { text: 'Reminder 1 sent', cls: 'chip-good' },
  'sent-day-7': { text: 'Reminder 2 sent', cls: 'chip-good' },
  'switched-off': { text: 'Not sent (reminders are switched off)', cls: 'chip-muted' },
  'not-due-yet': { text: 'Not due yet (sent after 3 days)', cls: 'chip-muted' },
  'not-sent': { text: 'Not sent', cls: 'chip-warn' },
  'not-applicable': { text: 'Not emailed (left checkout)', cls: 'chip-muted' },
};

const FIXED_TEXT: Record<FixedStatus, { text: string; cls: string }> = {
  'paid-since': { text: 'Paid since', cls: 'chip-good' },
  cancelled: { text: 'Cancelled', cls: 'chip-muted' },
  'still-unpaid': { text: 'Still unpaid', cls: 'chip-bad' },
};

function readToken(): string {
  return new URLSearchParams(window.location.search).get('token') || localStorage.getItem('admin_token') || '';
}

async function load(): Promise<FailedStatusResponse> {
  const token = readToken();
  const url = `/api/admin-failed-status${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Request failed (${res.status})`);
    }
    return await res.json();
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('This is taking too long. Try again in a minute.');
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

const money = (amount: number, currency: string): string =>
  new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency || 'GBP' }).format(amount);

const dateText = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function chip(label: { text: string; cls: string }): HTMLElement {
  return el('span', label.text, `chip ${label.cls}`);
}

function cell(child: Node | string, className?: string): HTMLTableCellElement {
  const td = el('td', undefined, className);
  td.append(child);
  return td;
}

function rowNode(row: FailedStatusRow): HTMLTableRowElement {
  const tr = el('tr');
  const donor = el('td');
  donor.append(el('div', row.donor));
  if (row.email && row.email !== row.donor) donor.append(el('div', row.email, 'kpi-desc'));
  tr.append(
    cell(row.kindLabel),
    donor,
    cell(money(row.amount, row.currency), 'num'),
    cell(dateText(row.failedAt)),
    cell(chip(EMAIL_TEXT[row.emailStatus])),
    cell(chip(FIXED_TEXT[row.fixedStatus]))
  );
  return tr;
}

function tableNode(result: FailedStatusResult): HTMLElement {
  const wrap = el('div', undefined, 'table-wrap');
  const table = el('table', undefined, 'data');
  table.setAttribute('aria-label', 'Failed payments this period');
  const headRow = el('tr');
  ['What it is', 'Donor', 'Amount', 'Date', 'Reminder email', 'Fixed?'].forEach((label) => {
    const th = el('th', label);
    th.scope = 'col';
    if (label === 'Amount') th.className = 'num';
    headRow.append(th);
  });
  const thead = el('thead');
  thead.append(headRow);
  const tbody = el('tbody');
  tbody.append(...result.rows.map(rowNode));
  table.append(thead, tbody);
  wrap.append(table);
  return wrap;
}

function summaryText(result: FailedStatusResult): string {
  const s = result.summary;
  return `${s.total} failed payment${s.total === 1 ? '' : 's'} in the last 45 days: ${s.stillUnpaid} still unpaid, ${s.fixed} paid since, ${s.emailed} with a reminder email sent.`;
}

export function initFailedStatus(): void {
  const button = document.getElementById('failed-status-load') as HTMLButtonElement | null;
  const status = document.getElementById('failed-status-line');
  const results = document.getElementById('failed-status-results');
  if (!button || !status || !results) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Loading… this reads the last 45 days of payments from Mollie.';
    try {
      const data = await load();
      const result = buildFailedStatus(data.payments, {
        paidTimesByCustomer: new Map(Object.entries(data.paidTimesByCustomer)),
        sentStages: new Set(data.sentStages),
        cancelledCustomerIds: new Set(data.cancelledCustomerIds),
        remindersEnabled: data.remindersEnabled,
        now: new Date(data.now),
      });
      status.textContent = result.rows.length ? summaryText(result) : 'No failed payments in the last 45 days.';
      button.textContent = 'Reload';
      results.replaceChildren(...(result.rows.length ? [tableNode(result)] : []));
    } catch (err) {
      status.textContent = `Could not load: ${err instanceof Error ? err.message : 'error'}`;
    } finally {
      button.disabled = false;
    }
  });
}
