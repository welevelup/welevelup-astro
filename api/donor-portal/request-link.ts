import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient } from '@mollie/api-client';
import { createHmac } from 'crypto';
import { Resend } from 'resend';

const FROM = 'Level Up <no-reply@welevelup.org>';
const SITE_URL = 'https://welevelup.org';

function createToken(payload: Record<string, unknown>, secret: string, ttlMs = 3_600_000): string {
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString('base64url');
  const sig = createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.MOLLIE_API_KEY;
  const secret = process.env.PORTAL_SECRET;
  const siteUrl = (process.env.PUBLIC_SITE_URL ?? SITE_URL).replace(/\\n/g, '').trim().replace(/\/$/, '');
  const resendKey = process.env.RESEND_API_KEY;

  if (!apiKey || !secret || !resendKey) {
    console.error('[request-link] missing env vars');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  const body = req.body as { email?: string };
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : undefined;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  // Always return 200 to avoid email enumeration
  const ok = () => res.status(200).json({ ok: true });

  try {
    const mollie = createMollieClient({ apiKey });
    let cursor: string | undefined;
    let customerId: string | undefined;

    do {
      const page = await mollie.customers.page({ from: cursor, limit: 250 });
      const list = Array.from(page as Iterable<{ id: string; email: string; metadata?: Record<string, string> | null }>);
      const match = list.find(
        (c) => c.email?.toLowerCase() === email && (c.metadata as Record<string, string> | null)?.source === 'astro'
      );
      if (match) {
        customerId = match.id;
        break;
      }
      cursor = (page as unknown as { nextPageCursor?: string }).nextPageCursor ?? undefined;
    } while (cursor);

    if (!customerId) return ok();

    const token = createToken({ email, mollieCustomerId: customerId }, secret);
    const url = `${siteUrl}/donor-portal/manage?token=${token}`;

    const resend = new Resend(resendKey);
    const LOGO_URL = 'https://levelup.yourmovement.org/rails/active_storage/blobs/eyJfcmFpbHMiOnsibWVzc2FnZSI6IkJBaHBBc01XIiwiZXhwIjpudWxsLCJwdXIiOiJibG9iX2lkIn19--899d9333f326b8d370f2acf06f7fe589aef9efd5/image.png';
    const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><style>@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700&display=swap');body,p,a,li,td{font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif!important;}body{margin:0;padding:0;background:#f4f4f4;}table{border-collapse:collapse;}img{border:0;height:auto;}</style></head><body style="margin:0;padding:0;background:#f4f4f4;"><table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 16px;"><tr><td align="center"><table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;"><tr><td style="padding:24px 40px;text-align:center;"><center><a href="${SITE_URL}" target="_blank"><img src="${LOGO_URL}" alt="Level Up Logo" width="120" style="display:inline-block;max-width:120px;margin:20px 0;"/></a></center></td></tr><tr><td style="padding:0 40px;"><div style="border-top:1px solid #e0e0e0;"></div></td></tr><tr><td style="padding:32px 40px 24px;font-size:16px;line-height:1.6;color:#000000;"><p style="margin:0 0 20px;">Hi,</p><p style="margin:0 0 24px;">Click the button below to access your Level Up donor portal. The link expires in <strong>1 hour</strong>.</p><table cellpadding="0" cellspacing="0" style="margin:24px auto;"><tr><td style="background:#7b68ee;border-radius:6px;"><a href="${url}" style="display:inline-block;padding:12px 28px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;font-family:'Montserrat','Helvetica Neue',Helvetica,Arial,sans-serif;">Access my portal</a></td></tr></table><p style="margin:24px 0 0;font-size:14px;color:#666;">If you didn't request this, you can ignore this email. Questions? <a href="mailto:hello@welevelup.org" style="color:#5b4fcf;">hello@welevelup.org</a></p></td></tr><tr><td style="padding:0 40px;"><div style="border-top:1px solid #e0e0e0;"></div></td></tr><tr><td style="padding:24px 40px 32px;text-align:center;"><center><a href="${SITE_URL}" target="_blank"><img src="${LOGO_URL}" alt="Level Up Logo" width="80" style="display:inline-block;max-width:80px;margin:20px 0;"/></a></center><p style="font-size:12px;color:#666;margin:0 0 8px;">New Derwent House, 69–73 Theobalds Road, London WC1X 8TA</p><p style="font-size:12px;color:#666;margin:0;"><a href="mailto:hello@welevelup.org" style="color:#5b4fcf;text-decoration:none;">hello@welevelup.org</a></p></td></tr></table></td></tr></table></body></html>`;
    await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Your Level Up donor portal access link',
      html,
    });

    console.log(`[request-link] magic link sent to ${email}`);
  } catch (err) {
    console.error('[request-link] error', err);
  }

  return ok();
}
