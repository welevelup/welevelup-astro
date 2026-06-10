import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

function cleanEnvVar(value: string): string {
  if (!value) return '';
  let cleaned = value
    .replace(/^["'\\n\\r]+/, '')
    .replace(/["'\\n\\r]+$/, '')
    .trim();
  if (cleaned.includes('UPSTASH_')) {
    const urlMatch = cleaned.match(/https:\/\/[a-z0-9-]+\.upstash\.io/);
    if (urlMatch) return urlMatch[0];
    const tokenMatch = cleaned.match(/[a-zA-Z0-9]+$/);
    if (tokenMatch) return tokenMatch[0];
  }
  return cleaned;
}

function getRedis(): Redis {
  const url = cleanEnvVar(process.env.UPSTASH_REDIS_REST_URL || '');
  const token = cleanEnvVar(process.env.UPSTASH_REDIS_REST_TOKEN || '');
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

interface AnalyticsData {
  users: number;
  sessions: number;
  avgSessionDuration: number;
  bounceRate: number;
  conversionRate: number;
  donationEvents: number;
  revenue: number;
  topPages: Array<{ path: string; users: number; sessions: number; avgDuration: number; bounceRate: number }>;
  trafficSources: Array<{ source: string; users: number; sessions: number; avgDuration: number; bounceRate: number; percentage: number }>;
  devices: Array<{ type: string; users: number; sessions: number; bounceRate: number }>;
  geography: Array<{ country: string; users: number; sessions: number; bounceRate: number }>;
  daily: Array<{ date: string; sessions: number; users: number }>;
  prevUsers: number;
  prevSessions: number;
  prevRevenue: number;
  prevDonationEvents: number;
  lastSync: string;
}

async function getAccessToken(serviceAccountKey: string): Promise<string> {
  let keyJson: any;
  try {
    keyJson = JSON.parse(serviceAccountKey);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: keyJson.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const signingInput = `${encode(header)}.${encode(payload)}`;

  const privateKeyPem = keyJson.private_key;
  const encoder = new TextEncoder();
  const keyData = privateKeyPem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const binaryKey = Uint8Array.from(Buffer.from(keyData, 'base64'));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signingInput)
  );

  const jwt = `${signingInput}.${Buffer.from(signature).toString('base64url')}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });
  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`OAuth token error: ${text.slice(0, 200)}`);
  }
  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

async function fetchGA4Data(serviceAccountKey: string): Promise<AnalyticsData> {
  console.log('[admin-analytics-sync] Fetching from Google Analytics 4 API');

  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!propertyId) throw new Error('GA4_PROPERTY_ID env var not set');

  const accessToken = await getAccessToken(serviceAccountKey);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  // Previous 28-day window (days -56..-29) for period-over-period deltas.
  const prevEndDate = new Date();
  prevEndDate.setDate(prevEndDate.getDate() - 29);
  const prevStartDate = new Date();
  prevStartDate.setDate(prevStartDate.getDate() - 56);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  // GA4 returns 'date' as 'YYYYMMDD'; normalise to 'YYYY-MM-DD'.
  const normDate = (d: string) => (d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` : d);

  // Run report for overview metrics
  const overviewRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
          { name: 'purchaseRevenue' },
        ],
      }),
    }
  );
  if (!overviewRes.ok) {
    const text = await overviewRes.text();
    throw new Error(`GA4 overview error: ${text.slice(0, 200)}`);
  }
  const overviewData = await overviewRes.json();
  const overviewRow = overviewData.rows?.[0]?.metricValues || [];
  const totalUsers = parseInt(overviewRow[0]?.value || '0', 10);
  const totalSessions = parseInt(overviewRow[1]?.value || '0', 10);
  const avgDuration = Math.round(parseFloat(overviewRow[2]?.value || '0'));
  const bounceRate = Math.round(parseFloat(overviewRow[3]?.value || '0') * 100) / 100;
  const revenue = Math.round(parseFloat(overviewRow[4]?.value || '0') * 100) / 100;

  // Run report for top pages
  const pagesRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions: [{ name: 'pagePath' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 10,
      }),
    }
  );
  if (!pagesRes.ok) {
    const text = await pagesRes.text();
    throw new Error(`GA4 pages error: ${text.slice(0, 200)}`);
  }
  const pagesData = await pagesRes.json();
  const topPages = (pagesData.rows || []).map((r: any) => ({
    path: r.dimensionValues[0].value,
    users: parseInt(r.metricValues[0].value, 10),
    sessions: parseInt(r.metricValues[1].value, 10),
    avgDuration: Math.round(parseFloat(r.metricValues[2].value || '0')),
    bounceRate: Math.round(parseFloat(r.metricValues[3].value || '0') * 100) / 100,
  }));

  // Run report for traffic sources
  const sourcesRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions: [{ name: 'sessionDefaultChannelGrouping' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'sessions' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 10,
      }),
    }
  );
  if (!sourcesRes.ok) {
    const text = await sourcesRes.text();
    throw new Error(`GA4 sources error: ${text.slice(0, 200)}`);
  }
  const sourcesData = await sourcesRes.json();
  const sourceRows = (sourcesData.rows || []).map((r: any) => ({
    source: r.dimensionValues[0].value,
    users: parseInt(r.metricValues[0].value, 10),
    sessions: parseInt(r.metricValues[1].value, 10),
    avgDuration: Math.round(parseFloat(r.metricValues[2].value || '0')),
    bounceRate: Math.round(parseFloat(r.metricValues[3].value || '0') * 100) / 100,
  }));
  const sourceTotal = sourceRows.reduce((s: number, r: any) => s + r.users, 0) || 1;
  const trafficSources = sourceRows.map((r: any) => ({
    source: r.source,
    users: r.users,
    sessions: r.sessions,
    avgDuration: r.avgDuration,
    bounceRate: r.bounceRate,
    percentage: Math.round((r.users / sourceTotal) * 1000) / 10,
  }));

  // Run report for devices
  const devicesRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions: [{ name: 'deviceCategory' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'bounceRate' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 10,
      }),
    }
  );
  const devicesData = await devicesRes.json();
  const devices = (devicesData.rows || []).map((r: any) => ({
    type: r.dimensionValues[0].value,
    users: parseInt(r.metricValues[0].value, 10),
    sessions: parseInt(r.metricValues[1].value, 10),
    bounceRate: parseFloat(r.metricValues[2].value || '0'),
  }));

  // Run report for geography
  const geoRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions: [{ name: 'country' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'bounceRate' }],
        orderBys: [{ metric: { metricName: 'totalUsers' }, desc: true }],
        limit: 10,
      }),
    }
  );
  const geoData = await geoRes.json();
  const geography = (geoData.rows || []).map((r: any) => ({
    country: r.dimensionValues[0].value,
    users: parseInt(r.metricValues[0].value, 10),
    sessions: parseInt(r.metricValues[1].value, 10),
    bounceRate: Math.round(parseFloat(r.metricValues[2].value || '0') * 100) / 100,
  }));

  // Real donation conversions: count of 'purchase' events in the period.
  const eventsRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { value: 'purchase' } },
        },
      }),
    }
  );
  let donationEvents = 0;
  if (eventsRes.ok) {
    const eventsData = await eventsRes.json();
    donationEvents = parseInt(eventsData.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
  } else {
    console.error('[admin-analytics-sync] GA4 events error:', (await eventsRes.text()).slice(0, 200));
  }
  const conversionRate = totalSessions > 0 ? Math.round((donationEvents / totalSessions) * 100 * 100) / 100 : 0;

  // Daily series for the current 28-day window.
  const dailyRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(startDate), endDate: fmt(endDate) }],
        dimensions: [{ name: 'date' }],
        metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
        orderBys: [{ dimension: { dimensionName: 'date' }, desc: false }],
      }),
    }
  );
  let daily: Array<{ date: string; sessions: number; users: number }> = [];
  if (dailyRes.ok) {
    const dailyData = await dailyRes.json();
    daily = (dailyData.rows || []).map((r: any) => ({
      date: normDate(r.dimensionValues[0].value),
      sessions: parseInt(r.metricValues[0].value, 10),
      users: parseInt(r.metricValues[1].value, 10),
    }));
  } else {
    console.error('[admin-analytics-sync] GA4 daily error:', (await dailyRes.text()).slice(0, 200));
  }

  // Previous-period overview for deltas (users, sessions, revenue, donation events).
  const prevOverviewRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(prevStartDate), endDate: fmt(prevEndDate) }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }, { name: 'purchaseRevenue' }],
      }),
    }
  );
  let prevUsers = 0, prevSessions = 0, prevRevenue = 0;
  if (prevOverviewRes.ok) {
    const prevData = await prevOverviewRes.json();
    const prevRow = prevData.rows?.[0]?.metricValues || [];
    prevUsers = parseInt(prevRow[0]?.value || '0', 10);
    prevSessions = parseInt(prevRow[1]?.value || '0', 10);
    prevRevenue = Math.round(parseFloat(prevRow[2]?.value || '0') * 100) / 100;
  } else {
    console.error('[admin-analytics-sync] GA4 prev overview error:', (await prevOverviewRes.text()).slice(0, 200));
  }

  // Previous-period donation events.
  const prevEventsRes = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dateRanges: [{ startDate: fmt(prevStartDate), endDate: fmt(prevEndDate) }],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        dimensionFilter: {
          filter: { fieldName: 'eventName', stringFilter: { value: 'purchase' } },
        },
      }),
    }
  );
  let prevDonationEvents = 0;
  if (prevEventsRes.ok) {
    const prevEventsData = await prevEventsRes.json();
    prevDonationEvents = parseInt(prevEventsData.rows?.[0]?.metricValues?.[0]?.value || '0', 10);
  }

  return {
    users: totalUsers,
    sessions: totalSessions,
    avgSessionDuration: avgDuration,
    bounceRate,
    conversionRate,
    donationEvents,
    revenue,
    topPages,
    trafficSources,
    devices,
    geography,
    daily,
    prevUsers,
    prevSessions,
    prevRevenue,
    prevDonationEvents,
    lastSync: new Date().toISOString(),
  };
}

async function verifySession(req: VercelRequest): Promise<boolean> {
  const cookies = req.headers.cookie ?? '';
  const match = cookies.match(/admin_session=([^;]+)/);
  if (!match) return false;
  const token = match[1];
  const url = cleanEnvVar(process.env.UPSTASH_REDIS_REST_URL || '');
  const tok = cleanEnvVar(process.env.UPSTASH_REDIS_REST_TOKEN || '');
  if (!url || !tok) return false;
  try {
    const r = await fetch(`${url}/v2/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([['GET', `session:${token}`]]),
    });
    const data = await r.json() as Array<{ result: string | null }>;
    return !!data[0]?.result;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for token in URL query param
  const url = new URL(req.url || '', 'http://localhost');
  const urlToken = url.searchParams.get('token');
  const hasSession = await verifySession(req);

  let isAuthenticated = hasSession;

  // If no session cookie, check if token is valid in Redis
  if (!isAuthenticated && urlToken) {
    try {
      const redis = getRedis();
      const session = await redis.get(`session:${urlToken}`);
      isAuthenticated = !!session;
    } catch (err) {
      console.error('[admin-analytics-sync] Redis check failed:', err);
    }
  }

  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[admin-analytics-sync] === ANALYTICS SYNC START ===');
    const redis = getRedis();

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';

    let analyticsData: AnalyticsData;

    if (serviceAccountKey) {
      console.log('[admin-analytics-sync] GOOGLE_SERVICE_ACCOUNT_KEY found — fetching live data');
      analyticsData = await fetchGA4Data(serviceAccountKey);
      console.log('[admin-analytics-sync] Fetched GA4 data:', analyticsData.users, 'users');
    } else {
      console.log('[admin-analytics-sync] No GOOGLE_SERVICE_ACCOUNT_KEY — returning cached Redis data');
      const cached = await redis.get<AnalyticsData>('admin:analytics');
      if (cached) {
        return res.status(200).json({ ok: true, data: cached, source: 'cache' });
      }
      return res.status(200).json({
        ok: true,
        data: null,
        source: 'none',
        message: 'No GOOGLE_SERVICE_ACCOUNT_KEY configured and no cached data found.',
      });
    }

    await redis.set('admin:analytics', analyticsData);
    await redis.set('admin:analyticsLastSync', analyticsData.lastSync);
    console.log('[admin-analytics-sync] Saved to Redis');

    return res.status(200).json({ ok: true, data: analyticsData, source: 'live' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin-analytics-sync] ERROR:', msg);
    return res.status(500).json({ error: msg, ok: false });
  }
}
