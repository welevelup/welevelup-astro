import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Redis } from '@upstash/redis';

// Raw facts for the "What are these failed payments?" section on the Donations
// tab: every failed or expired Mollie payment from the last 45 days, whether we
// sent a reminder, who paid since, and who cancelled. The browser turns this
// into plain rows with src/lib/failed-status.ts (the same shape this returns:
// payments + context). Read-only: it never sends an email or changes Mollie.
export const config = { maxDuration: 60 };

// Helpers are inlined on purpose: importing across directories breaks Vercel's
// function bundling for this project.
function getRedis(): Redis {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

async function verifySession(req: VercelRequest): Promise<boolean> {
  const cookies = req.headers.cookie ?? '';
  const match = cookies.match(/admin_session=([^;]+)/);
  const url = new URL(req.url || '', 'http://localhost');
  const token = match?.[1] || url.searchParams.get('token');
  if (!token) return false;
  try {
    const session = await getRedis().get(`session:${token}`);
    return !!session;
  } catch {
    return false;
  }
}

async function mollieGet(path: string, apiKey: string): Promise<any> {
  const res = await fetch(path.startsWith('http') ? path : `https://api.mollie.com/v2${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Mollie ${res.status} on ${path.split('?')[0]}`);
  return res.json();
}

async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 45;
const MAX_PAGES = 8;
const LOOKUP_CONCURRENCY = 6;
const STAGES = [3, 7] as const;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!(await verifySession(req))) return res.status(401).json({ error: 'Unauthorized' });
  res.setHeader('Cache-Control', 'private, no-store');

  const apiKey = process.env.MOLLIE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Mollie is not configured' });

  const now = new Date();
  const windowStart = new Date(now.getTime() - WINDOW_DAYS * DAY_MS).toISOString();

  try {
    // Newest first; stop once a whole page is older than the window.
    const payments: any[] = [];
    let url = '/payments?limit=250';
    for (let page = 0; page < MAX_PAGES && url; page++) {
      const data = await mollieGet(url, apiKey);
      const batch: any[] = data._embedded?.payments || [];
      payments.push(...batch);
      if (!batch.length || batch[batch.length - 1].createdAt < windowStart) break;
      url = data._links?.next?.href || '';
    }
    const recent = payments.filter((p) => p.createdAt >= windowStart);
    const failed = recent.filter((p) => p.status === 'failed' || p.status === 'expired');

    const customerIds = Array.from(new Set(failed.map((p) => p.customerId).filter(Boolean))) as string[];
    const lookups = await pool(customerIds, LOOKUP_CONCURRENCY, async (id) => {
      const [customer, subs] = await Promise.all([
        mollieGet(`/customers/${id}`, apiKey).catch(() => null),
        mollieGet(`/customers/${id}/subscriptions`, apiKey).catch(() => null),
      ]);
      const list: any[] = subs?._embedded?.subscriptions || [];
      const hasCanceled = list.some((s) => s.status === 'canceled');
      const hasLive = list.some((s) => s.status === 'active' || s.status === 'pending');
      return { id, customer, cancelled: hasCanceled && !hasLive };
    });
    const customerOf = new Map(lookups.map((l) => [l.id, l.customer] as const));

    const inScope = new Set(customerIds);
    const paidTimesByCustomer: Record<string, string[]> = {};
    for (const p of recent) {
      if (p.status !== 'paid' || !p.paidAt || !p.customerId || !inScope.has(p.customerId)) continue;
      paidTimesByCustomer[p.customerId] = [...(paidTimesByCustomer[p.customerId] || []), p.paidAt];
    }

    const reminderKeys = failed.flatMap((p) => STAGES.map((stage) => `${p.id}:${stage}`));
    const sentStages: string[] = [];
    if (reminderKeys.length) {
      const values = await getRedis().mget(...reminderKeys.map((k) => `failed-reminder:${k}`));
      values.forEach((value, i) => { if (value) sentStages.push(reminderKeys[i]); });
    }

    return res.status(200).json({
      now: now.toISOString(),
      remindersEnabled: process.env.FAILED_REMINDERS_ENABLED === 'true',
      payments: failed.map((p) => ({
        paymentId: p.id,
        customerId: p.customerId || '',
        donorName: (p.customerId && customerOf.get(p.customerId)?.name) || '',
        email: ((p.customerId && customerOf.get(p.customerId)?.email) || '').toLowerCase(),
        amount: parseFloat(p.amount?.value || '0'),
        currency: p.amount?.currency || 'GBP',
        gateway: 'mollie',
        sequenceType: p.sequenceType || 'oneoff',
        status: p.status,
        failedAt: p.createdAt,
      })),
      paidTimesByCustomer,
      sentStages,
      cancelledCustomerIds: lookups.filter((l) => l.cancelled).map((l) => l.id),
    });
  } catch (err) {
    // Log the failure kind only: error text can echo URLs, never donor details.
    console.error('admin-failed-status failed:', err instanceof Error ? err.message : 'unknown error');
    return res.status(500).json({ error: 'Could not read the failed payments. Try again in a minute.' });
  }
}
