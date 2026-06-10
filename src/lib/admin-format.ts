// Shared formatting + delta helpers for the admin dashboards.

export const fmtMoney = (n: number, currency = 'GBP') => {
  const sym = currency === 'EUR' ? '€' : currency === 'USD' ? '$' : '£';
  return sym + Number(n || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const fmtMoney0 = (n: number) =>
  '£' + Math.round(Number(n || 0)).toLocaleString('en-GB');

export const fmtNum = (n: number) => Number(n || 0).toLocaleString('en-GB');

export const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Never';

export const fmtDay = (s: string) => {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// mm:ss from seconds
export const fmtDuration = (seconds: number) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, '0')}`;
};

export interface Delta {
  pct: number; // signed percentage change
  positive: boolean; // whether to colour as good
  arrow: string; // ▲ or ▼
}

/**
 * Compute a delta chip from current/previous values.
 * `lowerIsBetter` inverts the colour (for bounce rate, position).
 * Returns null when there is no usable previous value (so the UI hides the chip).
 */
export function computeDelta(
  current: number | undefined | null,
  previous: number | undefined | null,
  lowerIsBetter = false
): Delta | null {
  if (current == null || previous == null) return null;
  if (previous === 0) return null;
  const raw = ((current - previous) / Math.abs(previous)) * 100;
  const pct = Math.round(raw * 10) / 10;
  const wentUp = current >= previous;
  const positive = lowerIsBetter ? !wentUp : wentUp;
  return { pct, positive, arrow: wentUp ? '▲' : '▼' };
}

/**
 * Absolute-point delta (e.g. Google position: -2.3 means moved up 2.3 places).
 * Returns null when previous is missing.
 */
export function computePointDelta(
  current: number | undefined | null,
  previous: number | undefined | null,
  lowerIsBetter = false
): { value: number; positive: boolean; arrow: string } | null {
  if (current == null || previous == null) return null;
  const diff = Math.round((current - previous) * 10) / 10;
  if (diff === 0) return { value: 0, positive: true, arrow: '▲' };
  const wentUp = diff > 0;
  const positive = lowerIsBetter ? !wentUp : wentUp;
  return { value: Math.abs(diff), positive, arrow: wentUp ? '▲' : '▼' };
}
