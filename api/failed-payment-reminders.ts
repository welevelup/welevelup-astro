import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Resend } from 'resend';
import { Redis } from '@upstash/redis';

// Daily job: reminds donors whose monthly gift failed, 3 and 7 days after the
// failure. Mollie does not retry a failed recurring payment by itself, so
// without this nobody is told. Ships DISABLED: until FAILED_REMINDERS_ENABLED
// is "true" it only reports what it would send, and never returns emails/names.
// Helpers are inlined on purpose (Vercel bundles each function on its own).
export const config = { maxDuration: 60 };

const FROM = 'Level Up <no-reply@welevelup.org>';
const SITE_URL = 'https://welevelup.org';
const FIRST_REMINDER_DAYS = 3;
const SECOND_REMINDER_DAYS = 7;
const STOP_AFTER_DAYS = 14;
const MAX_SENDS_PER_RUN = 25;
const CLAIM_TTL_SECONDS = 60 * 86400;
const DAY_MS = 86_400_000;

export type ReminderStage = 3 | 7;
export interface FailedCharge { paymentId: string; customerId: string; amount: string; failedAt: string }
export interface Reminder { paymentId: string; customerId: string; amount: string; stage: ReminderStage }

interface SelectInput {
  charges: FailedCharge[];
  /** True when this donor has a successful payment after the given failure time. */
  paidAfter: (customerId: string, failedAt: string) => boolean;
  alreadySent: (paymentId: string, stage: ReminderStage) => boolean;
  now: Date;
}

/** Decides who should get which reminder. Pure: no network, no clock of its own. */
export function selectReminders({ charges, paidAfter, alreadySent, now }: SelectInput): Reminder[] {
  const latestPerDonor = new Map<string, FailedCharge>();
  for (const charge of charges) {
    const current = latestPerDonor.get(charge.customerId);
    if (!current || charge.failedAt > current.failedAt) latestPerDonor.set(charge.customerId, charge);
  }

  const reminders: Reminder[] = [];
  for (const charge of latestPerDonor.values()) {
    const ageDays = (now.getTime() - new Date(charge.failedAt).getTime()) / DAY_MS;
    if (ageDays < FIRST_REMINDER_DAYS || ageDays >= STOP_AFTER_DAYS) continue;
    const stage: ReminderStage = ageDays >= SECOND_REMINDER_DAYS ? 7 : 3;
    if (alreadySent(charge.paymentId, stage)) continue;
    if (paidAfter(charge.customerId, charge.failedAt)) continue;
    reminders.push({ paymentId: charge.paymentId, customerId: charge.customerId, amount: charge.amount, stage });
  }
  return reminders;
}

// ── helpers ──────────────────────────────────────────────────────────────

function isAuthorised(req: VercelRequest): boolean {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.authorization || '';
  if (!secret || !header.startsWith('Bearer ')) return false;
  const digest = (value: string) => createHmac('sha256', 'reminders').update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');

async function mollieGet(path: string, apiKey: string): Promise<any> {
  const res = await fetch(path.startsWith('http') ? path : `https://api.mollie.com/v2${path}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) throw new Error(`Mollie ${res.status} on ${path.split('?')[0]}`);
  return res.json();
}

function emailHtml(name: string, amount: string, stage: ReminderStage): string {
  const first = escapeHtml(name ? name.split(' ')[0] : '');
  const intro = stage === 3
    ? `We tried to collect your monthly donation of <strong>£${escapeHtml(amount)}</strong> to Level Up, but the payment didn't go through.`
    : `A few days ago we couldn't collect your monthly donation of <strong>£${escapeHtml(amount)}</strong> to Level Up, and we haven't been able to since.`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Level Up</title></head>
<body style="margin:0;padding:24px;background:#f4f4f4;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#0c0a3e;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;padding:32px;border-radius:6px;font-size:15px;line-height:1.6;">
<p style="margin:0 0 20px;">${first ? `Hi ${first},` : 'Hi,'}</p>
<p style="margin:0 0 20px;">${intro} This is often an expired card, or not enough in the account on the day.</p>
<p style="margin:0 0 20px;">If you'd like to keep supporting us, you can set your donation up again in a minute:</p>
<p style="margin:24px 0;"><a href="${SITE_URL}/donate" style="display:inline-block;padding:12px 28px;background:#4930d9;color:#fffdf0;text-decoration:none;font-weight:700;border-radius:4px;">Set up my donation again</a></p>
<p style="margin:0 0 20px;">If you've already sorted it, or you'd rather stop, there's nothing you need to do. You can also just reply to this email and we'll help.</p>
<p style="margin:24px 0 4px;">Thank you,</p><p style="margin:0;">Level Up</p>
</div></body></html>`;
}

// ── handler ──────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorised(req)) return res.status(401).json({ error: 'Unauthorized' });

  const apiKey = process.env.MOLLIE_API_KEY;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!apiKey || !redisUrl || !redisToken) return res.status(500).json({ error: 'Not configured' });

  const enabled = process.env.FAILED_REMINDERS_ENABLED === 'true';
  const redis = new Redis({ url: redisUrl, token: redisToken });
  const now = new Date();
  const windowStart = new Date(now.getTime() - (STOP_AFTER_DAYS + 1) * DAY_MS).toISOString();

  try {
    // Recent payments, newest first, until we pass the look-back window.
    const payments: any[] = [];
    let url = '/payments?limit=250';
    for (let page = 0; page < 4 && url; page++) {
      const data = await mollieGet(url, apiKey);
      const batch: any[] = data._embedded?.payments || [];
      payments.push(...batch);
      if (!batch.length || batch[batch.length - 1].createdAt < windowStart) break;
      url = data._links?.next?.href || '';
    }
    const recent = payments.filter((p) => p.createdAt >= windowStart && p.customerId);

    const charges: FailedCharge[] = recent
      .filter((p) => p.status === 'failed' && p.sequenceType === 'recurring')
      .map((p) => ({ paymentId: p.id, customerId: p.customerId, amount: p.amount.value, failedAt: p.createdAt }));
    const paidTimes = new Map<string, string[]>();
    for (const p of recent) {
      if (p.status === 'paid' && p.paidAt) paidTimes.set(p.customerId, [...(paidTimes.get(p.customerId) || []), p.paidAt]);
    }

    const sentKeys = new Set<string>();
    for (const c of charges) {
      for (const stage of [3, 7] as const) {
        if (await redis.get(`failed-reminder:${c.paymentId}:${stage}`)) sentKeys.add(`${c.paymentId}:${stage}`);
      }
    }

    const due = selectReminders({
      charges,
      paidAfter: (customerId, failedAt) => (paidTimes.get(customerId) || []).some((t) => t > failedAt),
      alreadySent: (paymentId, stage) => sentKeys.has(`${paymentId}:${stage}`),
      now,
    });

    let sent = 0, skippedNoActiveSubscription = 0, errors = 0;
    if (enabled) {
      const resend = new Resend(process.env.RESEND_API_KEY || '');
      for (const reminder of due.slice(0, MAX_SENDS_PER_RUN)) {
        const claimKey = `failed-reminder:${reminder.paymentId}:${reminder.stage}`;
        try {
          // A donor who cancelled, or has no live subscription, is not reminded.
          const subs = await mollieGet(`/customers/${reminder.customerId}/subscriptions`, apiKey);
          const hasActive = (subs._embedded?.subscriptions || []).some((s: any) => s.status === 'active' || s.status === 'pending');
          if (!hasActive) { skippedNoActiveSubscription++; continue; }

          const customer = await mollieGet(`/customers/${reminder.customerId}`, apiKey);
          if (!customer.email) continue;
          const claimed = await redis.set(claimKey, '1', { nx: true, ex: CLAIM_TTL_SECONDS });
          if (!claimed) continue; // another run got there first

          const { error } = await resend.emails.send({
            from: FROM,
            to: customer.email,
            subject: reminder.stage === 3 ? "Your Level Up donation didn't go through" : 'Reminder: your Level Up donation',
            html: emailHtml(customer.name || '', reminder.amount, reminder.stage),
          });
          if (error) { await redis.del(claimKey); errors++; continue; }
          sent++;
        } catch (err) {
          await redis.del(claimKey).catch(() => {});
          errors++;
          console.error('[reminders] failed for one donor:', err instanceof Error ? err.message : String(err));
        }
      }
    }

    return res.status(200).json({
      enabled,
      failedChargesInWindow: charges.length,
      dueNow: due.length,
      firstReminders: due.filter((r) => r.stage === 3).length,
      secondReminders: due.filter((r) => r.stage === 7).length,
      sent,
      skippedNoActiveSubscription,
      errors,
    });
  } catch (err) {
    console.error('[reminders] run failed:', err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: 'Run failed' });
  }
}
