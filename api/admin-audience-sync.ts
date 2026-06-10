import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// Authenticated upload target for scripts/sync-audience-data.ts.
// The audience CSVs (personal data) never leave the maintainer's machine —
// the script aggregates locally by postcode district and POSTs only the
// anonymous aggregate here, where the dashboard's Redis can reach it.

function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

async function verifySession(req: VercelRequest): Promise<boolean> {
  const cookies = req.headers.cookie ?? '';
  const cookieToken = cookies.match(/admin_session=([^;]+)/)?.[1];
  const url = new URL(req.url || '', 'http://localhost');
  const urlToken = url.searchParams.get('token');
  const token = cookieToken || urlToken;
  if (!token) return false;
  try {
    const session = await getRedis().get(`session:${token}`);
    return !!session;
  } catch {
    return false;
  }
}

const MAX_DISTRICTS = 20000;

function isValidPayload(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.districts) || b.districts.length === 0 || b.districts.length > MAX_DISTRICTS) return false;
  if (typeof b.totalPeople !== 'number' || b.totalPeople < 0) return false;
  // Every district must be an aggregate — no full postcodes, no emails.
  return b.districts.every((d: unknown) => {
    if (!d || typeof d !== 'object') return false;
    const x = d as Record<string, unknown>;
    return (
      typeof x.district === 'string' &&
      !x.district.includes(' ') && // full postcodes contain a space
      typeof x.lat === 'number' &&
      typeof x.lng === 'number' &&
      typeof x.total === 'number'
    );
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!(await verifySession(req))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const body = req.body as Record<string, unknown> | undefined;
  if (!isValidPayload(body)) {
    return res.status(400).json({ error: 'Invalid audience payload' });
  }

  try {
    const redis = getRedis();
    const payload = { ...body, lastSync: new Date().toISOString() };
    await redis.set('admin:audience', payload);
    console.log(
      `[admin-audience-sync] saved: ${(body.districts as unknown[]).length} districts, totalPeople=${body.totalPeople}`
    );
    return res.status(200).json({
      ok: true,
      districts: (body.districts as unknown[]).length,
      totalPeople: body.totalPeople,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[admin-audience-sync] ERROR:', msg);
    return res.status(500).json({ error: msg, ok: false });
  }
}
