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

interface SEOData {
  topKeywords: Array<{ query: string; clicks: number; impressions: number; position: number; ctr: number; change: number | null }>;
  topPages: Array<{ url: string; clicks: number; impressions: number; position: number; ctr: number }>;
  devices: Array<{ device: string; clicks: number; impressions: number; ctr: number }>;
  geography: Array<{ country: string; clicks: number; impressions: number; ctr: number }>;
  searchAppearance: Array<{ type: string; count: number; percentage: number }>;
  daily: Array<{ date: string; clicks: number; impressions: number }>;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  avgCtr: number;
  prevTotalClicks: number;
  prevTotalImpressions: number;
  prevAvgPosition: number;
  prevAvgCtr: number;
  lastSync: string;
}

async function fetchGSCData(serviceAccountKey: string): Promise<SEOData> {
  console.log('[admin-seo-sync] Fetching from Google Search Console API');

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
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
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
  const accessToken = tokenData.access_token;

  // Current 28-day window: days -28..-1 (yesterday is the freshest day GSC reports)
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  // Previous 28-day window: days -56..-29
  const prevEndDate = new Date();
  prevEndDate.setDate(prevEndDate.getDate() - 29);
  const prevStartDate = new Date();
  prevStartDate.setDate(prevStartDate.getDate() - 56);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  // Discover which site URL the service account can actually access
  const sitesRes = await fetch(
    'https://www.googleapis.com/webmasters/v3/sites',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!sitesRes.ok) throw new Error(`GSC sites list error: ${await sitesRes.text()}`);
  const sitesData = await sitesRes.json();
  const siteEntries: Array<{ siteUrl: string; permissionLevel: string }> = sitesData.siteEntry || [];
  console.log('[admin-seo-sync] Service account can access sites:', siteEntries.map(s => s.siteUrl));

  // Pick the best matching site URL
  const preferredUrls = [
    'https://welevelup.org/',
    'sc-domain:welevelup.org',
    'https://www.welevelup.org/',
  ];
  let siteUrl = siteEntries.find(s => preferredUrls.includes(s.siteUrl))?.siteUrl || siteEntries[0]?.siteUrl;
  if (!siteUrl) throw new Error('Service account has no GSC properties. Add it to the property in Google Search Console.');

  console.log('[admin-seo-sync] Using site URL:', siteUrl);
  const encodedSite = encodeURIComponent(siteUrl);

  const queryGSC = async (
    dimensions: string[],
    rowLimit = 20,
    range: { start: Date; end: Date } = { start: startDate, end: endDate }
  ) => {
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startDate: fmt(range.start),
          endDate: fmt(range.end),
          dimensions,
          rowLimit,
          startRow: 0,
        }),
      }
    );
    if (!res.ok) throw new Error(`GSC error: ${await res.text()}`);
    return (await res.json()).rows || [];
  };

  const keywordRows = await queryGSC(['query'], 10);
  const pageRows = await queryGSC(['page'], 10);
  const deviceRows = await queryGSC(['device'], 10);
  const countryRows = await queryGSC(['country'], 10);
  // searchAppearance is a valid GSC dimension (not searchType)
  const searchAppearanceRows = await queryGSC(['searchAppearance'], 10);

  // Real daily series for the current 28-day window (each date row carries clicks,
  // impressions, ctr and position for that day).
  const dailyRows = await queryGSC(['date'], 1000);
  // Daily series for the previous 28-day window — used for site-wide period deltas.
  const prevDailyRows = await queryGSC(['date'], 1000, { start: prevStartDate, end: prevEndDate });
  // Previous-period keyword positions — used to compute per-keyword position change.
  const prevKeywordRows = await queryGSC(['query'], 25, { start: prevStartDate, end: prevEndDate });

  const prevPosByQuery = new Map<string, number>();
  for (const r of prevKeywordRows) prevPosByQuery.set(r.keys[0], r.position);

  const topKeywords = keywordRows.map((r: any) => {
    const prevPos = prevPosByQuery.get(r.keys[0]);
    // Positive change = position improved (got smaller / closer to #1).
    const change = prevPos === undefined ? null : Math.round((prevPos - r.position) * 10) / 10;
    return {
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      position: Math.round(r.position * 10) / 10,
      ctr: Math.round(r.ctr * 10000) / 100,
      change,
    };
  });

  const topPages = pageRows.map((r: any) => ({
    url: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: Math.round(r.position * 10) / 10,
    ctr: Math.round(r.ctr * 10000) / 100,
  }));

  const deviceMap: { [key: string]: string } = { 'MOBILE': 'Mobile', 'DESKTOP': 'Desktop', 'TABLET': 'Tablet' };
  const devices = deviceRows.map((r: any) => ({
    device: deviceMap[r.keys[0]] || r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: Math.round(r.ctr * 10000) / 100,
  }));

  const countryMap: { [key: string]: string } = {
    'GB': 'United Kingdom', 'US': 'United States', 'IE': 'Ireland', 'CA': 'Canada', 'AU': 'Australia'
  };
  const geography = countryRows.map((r: any) => ({
    country: countryMap[r.keys[0]] || r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: Math.round(r.ctr * 10000) / 100,
  }));

  const typeMap: { [key: string]: string } = {
    'WEB': 'Web Results',
    'IMAGE': 'Image Results',
    'VIDEO': 'Video',
    'NEWS': 'News',
    'TRANSLATED_RESULT': 'Translated Results',
    'RICH_CARD': 'Rich Card',
    'AMP_BLUE_LINK': 'AMP Page',
    'AMP_TOP_STORIES': 'AMP Top Stories',
    'SUBSCRIBED_CONTENT': 'Subscribed Content',
  };
  const totalImp = searchAppearanceRows.reduce((s, r: any) => s + r.impressions, 0);
  const searchAppearance = searchAppearanceRows.map((r: any) => ({
    type: typeMap[r.keys[0]] || r.keys[0],
    count: r.impressions,
    percentage: totalImp > 0 ? Math.round((r.impressions / totalImp) * 100) : 0,
  }));

  // Site-wide totals derived from the real daily series.
  // avgPosition = position weighted by impressions across the days.
  const summarise = (rows: any[]) => {
    const clicks = rows.reduce((s, r) => s + r.clicks, 0);
    const impressions = rows.reduce((s, r) => s + r.impressions, 0);
    const weightedPos = rows.reduce((s, r) => s + r.position * r.impressions, 0);
    const avgPos = impressions > 0 ? Math.round((weightedPos / impressions) * 10) / 10 : 0;
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;
    return { clicks, impressions, avgPos, ctr };
  };

  const cur = summarise(dailyRows);
  const prev = summarise(prevDailyRows);

  const daily = dailyRows
    .map((r: any) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions }))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  return {
    topKeywords,
    topPages,
    devices,
    geography,
    searchAppearance,
    daily,
    totalClicks: cur.clicks,
    totalImpressions: cur.impressions,
    avgPosition: cur.avgPos,
    avgCtr: cur.ctr,
    prevTotalClicks: prev.clicks,
    prevTotalImpressions: prev.impressions,
    prevAvgPosition: prev.avgPos,
    prevAvgCtr: prev.ctr,
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
      console.error('[admin-seo-sync] Redis check failed:', err);
    }
  }

  if (!isAuthenticated) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    console.log('[admin-seo-sync] === SEO SYNC START ===');
    const redis = getRedis();

    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY || '';

    let seoData: SEOData;

    if (serviceAccountKey) {
      console.log('[admin-seo-sync] GOOGLE_SERVICE_ACCOUNT_KEY found — fetching live data');
      seoData = await fetchGSCData(serviceAccountKey);
      console.log('[admin-seo-sync] Fetched', seoData.topKeywords.length, 'keywords from GSC');
    } else {
      console.log('[admin-seo-sync] No GOOGLE_SERVICE_ACCOUNT_KEY — returning cached Redis data');
      const cached = await redis.get<SEOData>('admin:seo');
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

    await redis.set('admin:seo', seoData);
    await redis.set('admin:seoLastSync', seoData.lastSync);
    console.log('[admin-seo-sync] Saved to Redis');

    return res.status(200).json({ ok: true, data: seoData, source: 'live' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin-seo-sync] ERROR:', msg);
    return res.status(500).json({ error: msg, ok: false });
  }
}
