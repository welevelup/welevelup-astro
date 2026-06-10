// Server-side SVG chart helpers for the admin dashboards.
// Each returns an SVG string built in Astro frontmatter — no canvas, no client JS.

const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const shortDate = (iso: string) => {
  // 'YYYY-MM-DD' -> 'D Mon'
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return `${d.getUTCDate()} ${d.toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' })}`;
};

interface BarChartOpts {
  ariaLabel: string;
  color?: string;
  valueLabel?: string; // e.g. 'clicks'
}

/**
 * Single-series daily bar chart (e.g. visitors per day, clicks per day).
 */
export function dailyBarChart(
  data: Array<{ date: string; value: number }>,
  opts: BarChartOpts
): string {
  if (!data || data.length === 0) return '';
  const W = 820, H = 240, PL = 40, PR = 16, PT = 16, PB = 30;
  const gW = W - PL - PR, gH = H - PT - PB;
  const color = opts.color || '#5B4FCF';
  const max = Math.max(...data.map((d) => d.value), 1);
  const n = data.length;
  const slot = gW / n;
  const bw = Math.max(2, slot * 0.62);

  const yOf = (v: number) => PT + gH - (v / max) * gH;

  let bars = '';
  data.forEach((d, i) => {
    const x = PL + i * slot + (slot - bw) / 2;
    const y = yOf(d.value);
    const h = PT + gH - y;
    bars += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="1.5" fill="${color}"><title>${esc(shortDate(d.date))}: ${d.value} ${esc(opts.valueLabel || '')}</title></rect>`;
  });

  // Axes: baseline + max line, first/last/max labels
  const maxLineY = yOf(max);
  let axis = '';
  axis += `<line x1="${PL}" y1="${(PT + gH).toFixed(1)}" x2="${W - PR}" y2="${(PT + gH).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
  axis += `<line x1="${PL}" y1="${maxLineY.toFixed(1)}" x2="${W - PR}" y2="${maxLineY.toFixed(1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>`;
  axis += `<text x="${PL - 6}" y="${(maxLineY + 4).toFixed(1)}" font-size="10" fill="var(--text-3)" text-anchor="end" font-family="DM Sans,sans-serif">${max}</text>`;
  axis += `<text x="${PL - 6}" y="${(PT + gH + 4).toFixed(1)}" font-size="10" fill="var(--text-3)" text-anchor="end" font-family="DM Sans,sans-serif">0</text>`;

  let xlabels = '';
  const firstX = PL + 0 * slot + slot / 2;
  const lastX = PL + (n - 1) * slot + slot / 2;
  xlabels += `<text x="${firstX.toFixed(1)}" y="${H - 8}" font-size="10" fill="var(--text-3)" text-anchor="middle" font-family="DM Sans,sans-serif">${esc(shortDate(data[0].date))}</text>`;
  xlabels += `<text x="${lastX.toFixed(1)}" y="${H - 8}" font-size="10" fill="var(--text-3)" text-anchor="middle" font-family="DM Sans,sans-serif">${esc(shortDate(data[n - 1].date))}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${esc(opts.ariaLabel)}" xmlns="http://www.w3.org/2000/svg"><title>${esc(opts.ariaLabel)}</title>${axis}${bars}${xlabels}</svg>`;
}

/**
 * Two-series daily chart: impressions as a tinted area behind, clicks as a line in front.
 */
export function impressionsClicksChart(
  data: Array<{ date: string; clicks: number; impressions: number }>,
  ariaLabel: string
): string {
  if (!data || data.length === 0) return '';
  const W = 820, H = 240, PL = 44, PR = 44, PT = 16, PB = 30;
  const gW = W - PL - PR, gH = H - PT - PB;
  const n = data.length;
  const impColor = '#A89CED';
  const clickColor = '#5B4FCF';

  const maxImp = Math.max(...data.map((d) => d.impressions), 1);
  const maxClick = Math.max(...data.map((d) => d.clicks), 1);

  const xOf = (i: number) => PL + (n === 1 ? gW / 2 : (i / (n - 1)) * gW);
  const yImp = (v: number) => PT + gH - (v / maxImp) * gH;
  const yClick = (v: number) => PT + gH - (v / maxClick) * gH;

  // Impressions area
  const areaTop = data.map((d, i) => `${xOf(i).toFixed(1)},${yImp(d.impressions).toFixed(1)}`).join(' ');
  const area = `<polygon points="${PL},${(PT + gH).toFixed(1)} ${areaTop} ${(W - PR)},${(PT + gH).toFixed(1)}" fill="${impColor}" fill-opacity="0.22"/>`;
  const impLine = `<polyline points="${areaTop}" fill="none" stroke="${impColor}" stroke-width="1.5" stroke-opacity="0.7"/>`;

  // Clicks line
  const clickPts = data.map((d, i) => `${xOf(i).toFixed(1)},${yClick(d.clicks).toFixed(1)}`).join(' ');
  const clickLine = `<polyline points="${clickPts}" fill="none" stroke="${clickColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>`;

  // Dots with tooltips on clicks
  let dots = '';
  data.forEach((d, i) => {
    dots += `<circle cx="${xOf(i).toFixed(1)}" cy="${yClick(d.clicks).toFixed(1)}" r="2.6" fill="${clickColor}"><title>${esc(shortDate(d.date))}: ${d.clicks} clicks, ${d.impressions} impressions</title></circle>`;
  });

  // Axes
  let axis = '';
  axis += `<line x1="${PL}" y1="${(PT + gH).toFixed(1)}" x2="${W - PR}" y2="${(PT + gH).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
  // left axis = clicks max, right axis = impressions max
  axis += `<text x="${PL - 6}" y="${(PT + 4).toFixed(1)}" font-size="10" fill="${clickColor}" text-anchor="end" font-family="DM Sans,sans-serif">${maxClick}</text>`;
  axis += `<text x="${W - PR + 6}" y="${(PT + 4).toFixed(1)}" font-size="10" fill="${impColor}" text-anchor="start" font-family="DM Sans,sans-serif">${maxImp}</text>`;

  let xlabels = '';
  xlabels += `<text x="${xOf(0).toFixed(1)}" y="${H - 8}" font-size="10" fill="var(--text-3)" text-anchor="middle" font-family="DM Sans,sans-serif">${esc(shortDate(data[0].date))}</text>`;
  xlabels += `<text x="${xOf(n - 1).toFixed(1)}" y="${H - 8}" font-size="10" fill="var(--text-3)" text-anchor="middle" font-family="DM Sans,sans-serif">${esc(shortDate(data[n - 1].date))}</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${esc(ariaLabel)}" xmlns="http://www.w3.org/2000/svg"><title>${esc(ariaLabel)}</title>${axis}${area}${impLine}${clickLine}${dots}${xlabels}</svg>`;
}

/**
 * Stacked monthly bar chart: monthly (recurring, navy) + one-off (violet).
 */
export function stackedMonthlyChart(
  data: Array<{ month: string; monthly: number; oneoff: number }>,
  ariaLabel: string
): string {
  if (!data || data.length === 0) return '';
  const W = 820, H = 260, PL = 48, PR = 16, PT = 16, PB = 36;
  const gW = W - PL - PR, gH = H - PT - PB;
  const navy = '#0C0A3E';
  const violet = '#A89CED';
  const n = data.length;
  const slot = gW / n;
  const bw = Math.max(4, slot * 0.6);

  const max = Math.max(...data.map((d) => d.monthly + d.oneoff), 1);
  const yOf = (v: number) => PT + gH - (v / max) * gH;
  const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const mLabel = (m: string) => monthNames[parseInt((m || '').slice(5), 10)] || (m || '').slice(5);
  const money = (v: number) => '£' + Math.round(v).toLocaleString('en-GB');

  let bars = '', xlabels = '';
  data.forEach((d, i) => {
    const x = PL + i * slot + (slot - bw) / 2;
    const total = d.monthly + d.oneoff;
    const yMonthly = yOf(d.monthly);
    const hMonthly = PT + gH - yMonthly;
    const yTotal = yOf(total);
    const hOneoff = yMonthly - yTotal;
    // monthly (navy) sits at the bottom, one-off (violet) stacks on top
    bars += `<rect x="${x.toFixed(1)}" y="${yMonthly.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, hMonthly).toFixed(1)}" fill="${navy}"><title>${esc(mLabel(d.month))}: recurring ${money(d.monthly)}</title></rect>`;
    bars += `<rect x="${x.toFixed(1)}" y="${yTotal.toFixed(1)}" width="${bw.toFixed(1)}" height="${Math.max(0, hOneoff).toFixed(1)}" fill="${violet}"><title>${esc(mLabel(d.month))}: one-off ${money(d.oneoff)}</title></rect>`;
    xlabels += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 12}" font-size="10" fill="var(--text-3)" text-anchor="middle" font-family="DM Sans,sans-serif">${esc(mLabel(d.month))}</text>`;
  });

  let axis = '';
  axis += `<line x1="${PL}" y1="${(PT + gH).toFixed(1)}" x2="${W - PR}" y2="${(PT + gH).toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
  axis += `<line x1="${PL}" y1="${PT.toFixed(1)}" x2="${W - PR}" y2="${PT.toFixed(1)}" stroke="var(--border)" stroke-width="1" stroke-dasharray="3,3"/>`;
  axis += `<text x="${PL - 6}" y="${(PT + 4).toFixed(1)}" font-size="10" fill="var(--text-3)" text-anchor="end" font-family="DM Sans,sans-serif">${money(max)}</text>`;
  axis += `<text x="${PL - 6}" y="${(PT + gH + 4).toFixed(1)}" font-size="10" fill="var(--text-3)" text-anchor="end" font-family="DM Sans,sans-serif">£0</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="chart-svg" role="img" aria-label="${esc(ariaLabel)}" xmlns="http://www.w3.org/2000/svg"><title>${esc(ariaLabel)}</title>${axis}${bars}${xlabels}</svg>`;
}
