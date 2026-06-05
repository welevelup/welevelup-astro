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
  topKeywords: Array<{ keyword: string; clicks: number; impressions: number; position: number; ctr: number }>;
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  avgCtr: number;
  lastSync: string;
}

async function fetchGSCData(serviceAccountKey: string): Promise<SEOData> {
  console.log('[admin-seo-sync] Fetching from Google Search Console API');

  // Parse service account key
  let keyJson: any;
  try {
    keyJson = JSON.parse(serviceAccountKey);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY is not valid JSON');
  }

  // Build JWT for service account auth
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

  // Import private key and sign
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

  // Exchange JWT for access token
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

  // Query Search Console for top queries (last 28 days)
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 28);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  const queryRes = await fetch(
    'https://www.googleapis.com/webmasters/v3/sites/https%3A%2F%2Fwelevelup.org%2F/searchAnalytics/query',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate: fmt(startDate),
        endDate: fmt(endDate),
        dimensions: ['query'],
        rowLimit: 20,
        startRow: 0,
      }),
    }
  );

  if (!queryRes.ok) {
    const text = await queryRes.text();
    throw new Error(`GSC query error: ${text.slice(0, 200)}`);
  }

  const queryData = await queryRes.json();
  const rows: any[] = queryData.rows || [];

  const topKeywords = rows.map((r: any) => ({
    keyword: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    position: Math.round(r.position * 10) / 10,
    ctr: Math.round(r.ctr * 10000) / 100,
  }));

  const totalClicks = rows.reduce((s: number, r: any) => s + r.clicks, 0);
  const totalImpressions = rows.reduce((s: number, r: any) => s + r.impressions, 0);
  const avgPosition =
    rows.length > 0
      ? Math.round((rows.reduce((s: number, r: any) => s + r.position, 0) / rows.length) * 10) / 10
      : 0;
  const avgCtr =
    totalImpressions > 0
      ? Math.round((totalClicks / totalImpressions) * 10000) / 100
      : 0;

  return {
    topKeywords,
    totalClicks,
    totalImpressions,
    avgPosition,
    avgCtr,
    lastSync: new Date().toISOString(),
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
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
