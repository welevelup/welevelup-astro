// Browser wiring for the "Lost donors across months" section.
// The maths lives in ./lost-donors; this file only fetches, renders and exports.
import { buildLostMatrix, type CellState, type LostMatrix, type LostResponse, type LostRow } from './lost-donors';
import { monthLabel } from './month-explorer';

const FETCH_TIMEOUT_MS = 75_000;

const escapeHtml = (value: string): string =>
  (value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

const CELL: Record<CellState, { glyph: string; cls: string; text: string }> = {
  before: { glyph: '', cls: 'lost-cell-before', text: '' },
  gave: { glyph: '✓', cls: 'lost-cell-gave', text: 'Gave' },
  'lost-failed': { glyph: '✕', cls: 'lost-cell-failed', text: 'Lost — payment failed (fixable)' },
  'lost-no-charge': { glyph: '✕', cls: 'lost-cell-lost', text: 'Lost — no charge made' },
  away: { glyph: '–', cls: 'lost-cell-away', text: 'Not giving' },
};

const shortMonth = (month: string): string => monthLabel(month).slice(0, 3);
const money = (n: number): string => (n ? `£${n.toFixed(2)}` : '—');

function readToken(): string {
  return new URLSearchParams(window.location.search).get('token') || localStorage.getItem('admin_token') || '';
}

async function load(): Promise<LostResponse & { unidentified?: number }> {
  const token = readToken();
  const url = `/api/admin-lost-donors${token ? `?token=${encodeURIComponent(token)}` : ''}`;
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
      throw new Error('This is taking too long. Try again in a minute — the next attempt is usually faster.');
    }
    throw err;
  } finally {
    window.clearTimeout(timer);
  }
}

// ── rendering ───────────────────────────────────────────────────────────

function summaryHtml(matrix: LostMatrix, unidentified: number): string {
  const s = matrix.summary;
  const quick = s.eligibleEvents ? `${s.returnedWithin2Months} of ${s.eligibleEvents}` : '—';
  const stat = (label: string, value: string, hint: string) =>
    `<div class="kpi"><div class="kpi-label">${escapeHtml(label)}</div><div class="kpi-value" style="font-size:26px">${escapeHtml(value)}</div><div class="kpi-desc">${escapeHtml(hint)}</div></div>`;
  const note = unidentified
    ? `<p class="kpi-desc" style="margin-top:12px">${unidentified} gift${unidentified === 1 ? '' : 's'} had no name or email from the gateway, so they are left out rather than mixed together.</p>`
    : '';
  return `<div class="kpi-grid">${[
    stat('People lost', String(s.uniqueLost), 'Stopped giving at least once.'),
    stat('Times lost', String(s.lostEvents), 'Total stops, counting repeats.'),
    stat('Lost more than once', String(s.repeaters), 'Came back and stopped again.'),
    stat('Came back', String(s.returned), 'Gave again after stopping.'),
    stat('Back within 2 months', quick, 'Of the stops old enough to tell.'),
    stat('Still away', String(s.stillAway), 'Not giving in the latest month.'),
  ].join('')}</div>${note}`;
}

function barsHtml(matrix: LostMatrix): string {
  const data = matrix.summary.byMonth;
  const max = Math.max(...data.map((d) => d.lost), 1);
  const W = 820, H = 160, PL = 28, PR = 8, PT = 14, PB = 26;
  const slot = (W - PL - PR) / data.length;
  const bw = Math.max(6, slot * 0.5);
  const gH = H - PT - PB;
  const bars = data
    .map((d, i) => {
      const h = (d.lost / max) * gH;
      const x = PL + i * slot + (slot - bw) / 2;
      const label = `${monthLabel(d.month)}: ${d.lost} lost`;
      return `<rect x="${x.toFixed(1)}" y="${(PT + gH - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="#B91C1C"><title>${escapeHtml(label)}</title></rect>` +
        `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" font-size="10" fill="var(--text-3)" text-anchor="middle" font-family="DM Sans,sans-serif">${escapeHtml(shortMonth(d.month))}</text>` +
        (d.lost ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(PT + gH - h - 4).toFixed(1)}" font-size="10" fill="var(--text-2)" text-anchor="middle" font-family="DM Sans,sans-serif">${d.lost}</text>` : '');
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="People lost per month"><line x1="${PL}" y1="${PT + gH}" x2="${W - PR}" y2="${PT + gH}" stroke="var(--border)"/>${bars}</svg>`;
}

function rowHtml(row: LostRow, months: string[]): string {
  const cells = months
    .map((m) => {
      const c = CELL[row.cells[m]];
      return `<td class="lost-cell ${c.cls}" title="${escapeHtml(`${monthLabel(m)}: ${c.text}`)}" aria-label="${escapeHtml(`${monthLabel(m)}: ${c.text || 'no data'}`)}">${c.glyph}</td>`;
    })
    .join('');
  const sub = row.email && row.email !== row.label ? `<div class="kpi-desc">${escapeHtml(row.email)}</div>` : '';
  const back = row.returned ? (row.stillAway ? 'Back, then left again' : 'Back') : 'No';
  return `<tr><th scope="row" class="lost-donor">${escapeHtml(row.label)}${sub}</th><td style="text-transform:capitalize">${escapeHtml(row.gateway)}</td><td class="num">${money(row.amount)}</td>${cells}<td class="num"><strong>${row.timesLost}</strong></td><td>${back}</td></tr>`;
}

function tableHtml(rows: LostRow[], months: string[]): string {
  if (!rows.length) return '<div class="empty" style="padding:20px">Nobody matches this filter.</div>';
  const head = months.map((m) => `<th scope="col" class="lost-cell-head">${escapeHtml(shortMonth(m))}</th>`).join('');
  return `<div class="table-wrap lost-table-wrap"><table class="data lost-table"><thead><tr><th scope="col">Donor</th><th scope="col">Provider</th><th scope="col" class="num">Gift</th>${head}<th scope="col" class="num">Times lost</th><th scope="col">Came back?</th></tr></thead><tbody>${rows.map((r) => rowHtml(r, months)).join('')}</tbody></table></div>`;
}

const legendHtml = (): string =>
  `<div class="chart-legend lost-legend"><span class="legend-item"><span class="lost-cell-gave">✓</span> Gave</span><span class="legend-item"><span class="lost-cell-lost">✕</span> Lost (no charge made)</span><span class="legend-item"><span class="lost-cell-failed">✕</span> Lost (payment failed — fixable)</span><span class="legend-item"><span class="lost-cell-away">–</span> Not giving</span></div>`;

// ── CSV ─────────────────────────────────────────────────────────────────

/** Quotes a value and neutralises spreadsheet formulas (=, +, -, @). */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function csvFor(rows: LostRow[], months: string[]): string {
  const header = ['Donor', 'Email', 'Provider', 'Gift (GBP)', ...months.map(monthLabel), 'Times lost', 'Came back', 'Still away'];
  const lines = rows.map((r) =>
    [
      r.label, r.email || '', r.gateway, r.amount ? r.amount.toFixed(2) : '',
      ...months.map((m) => CELL[r.cells[m]].text || ''),
      String(r.timesLost), r.returned ? 'yes' : 'no', r.stillAway ? 'yes' : 'no',
    ].map(csvCell).join(',')
  );
  return [header.map(csvCell).join(','), ...lines].join('\n');
}

function download(filename: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── wiring ──────────────────────────────────────────────────────────────

export function initLostDonors(): void {
  const root = document.getElementById('lost-donors');
  const button = document.getElementById('lost-load') as HTMLButtonElement | null;
  const status = document.getElementById('lost-status');
  const results = document.getElementById('lost-results');
  if (!root || !button || !status || !results) return;

  let matrix: LostMatrix | null = null;
  let onlyRepeaters = false;
  let onlyAway = false;

  const visibleRows = (): LostRow[] =>
    (matrix?.rows ?? []).filter((r) => (!onlyRepeaters || r.timesLost >= 2) && (!onlyAway || r.stillAway));

  const redrawTable = () => {
    const holder = document.getElementById('lost-table');
    if (holder && matrix) holder.innerHTML = tableHtml(visibleRows(), matrix.months);
  };

  const render = (unidentified: number) => {
    if (!matrix) return;
    results.innerHTML = `${summaryHtml(matrix, unidentified)}
      <div class="card" style="margin-top:16px"><div class="section-title" style="margin-bottom:8px">People lost per month</div>${barsHtml(matrix)}</div>
      <div class="lost-controls">
        <label><input type="checkbox" id="lost-only-repeaters"> Only people lost more than once</label>
        <label><input type="checkbox" id="lost-only-away"> Only people still away</label>
        <button type="button" class="btn btn-ghost" id="lost-csv">Download CSV</button>
      </div>
      ${legendHtml()}
      <div id="lost-table"></div>`;
    redrawTable();
  };

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'Loading… this reads every payment from Mollie, GoCardless and PayPal once, and can take up to a minute.';
    try {
      const data = await load();
      matrix = buildLostMatrix(data);
      status.textContent = `Last 12 complete months, ${monthLabel(matrix.months[0])} to ${monthLabel(matrix.months[matrix.months.length - 1])}.`;
      button.textContent = 'Reload';
      render(data.unidentified ?? 0);
    } catch (err) {
      status.textContent = `Could not load: ${err instanceof Error ? err.message : 'error'}`;
    } finally {
      button.disabled = false;
    }
  });

  root.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    if (target.id === 'lost-only-repeaters') onlyRepeaters = target.checked;
    else if (target.id === 'lost-only-away') onlyAway = target.checked;
    else return;
    redrawTable();
  });

  root.addEventListener('click', (event) => {
    if (!(event.target as Element).closest('#lost-csv') || !matrix) return;
    download('lost-donors-by-month.csv', csvFor(visibleRows(), matrix.months));
  });
}
