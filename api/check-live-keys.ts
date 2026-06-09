import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const mollieKey = process.env.MOLLIE_API_KEY || '';
  const ga4Secret = process.env.GA4_API_SECRET || '';
  const resendKey = process.env.RESEND_API_KEY || '';

  const checks = {
    mollie: {
      configured: !!mollieKey,
      isLive: mollieKey.startsWith('live_'),
      keyFormat: mollieKey.startsWith('live_') ? 'LIVE ✅' : mollieKey.startsWith('test_') ? 'TEST ❌' : 'UNKNOWN ⚠️',
      keyPrefix: mollieKey.slice(0, 10) + '***',
    },
    ga4: {
      configured: !!ga4Secret,
      keyLength: ga4Secret.length,
      warning: !ga4Secret ? '⚠️ GA4 secret not configured' : '✅ Configured',
    },
    resend: {
      configured: !!resendKey,
      warning: !resendKey ? '⚠️ Resend key not configured' : '✅ Configured',
    },
  };

  const allLive = checks.mollie.isLive && checks.ga4.configured && checks.resend.configured;

  return res.status(200).json({
    status: allLive ? '✅ ALL PRODUCTION KEYS CONFIGURED' : '❌ MISSING OR TEST KEYS',
    checks,
    production_ready: allLive,
  });
}
