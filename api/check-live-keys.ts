import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createMollieClient } from '@mollie/api-client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const mollieKey = process.env.MOLLIE_API_KEY || '';
  const ga4Secret = process.env.GA4_API_SECRET || '';
  const resendKey = process.env.RESEND_API_KEY || '';

  let mollieEnvironment = 'UNKNOWN';
  let mollieError = null;

  // Verify Mollie connection to LIVE API
  if (mollieKey) {
    try {
      const mollie = createMollieClient({ apiKey: mollieKey });
      const profile = await mollie.profiles.page();
      // If we can fetch profiles, we're connected to actual Mollie API
      mollieEnvironment = mollieKey.startsWith('live_') ? 'LIVE ✅' : 'TEST ⚠️';
    } catch (err) {
      mollieError = err instanceof Error ? err.message : String(err);
      // If key is invalid, it's likely test key or misconfigured
      mollieEnvironment = mollieKey.startsWith('live_') ? 'LIVE (connection failed)' : 'TEST';
    }
  }

  const checks = {
    mollie: {
      configured: !!mollieKey,
      environment: mollieEnvironment,
      isLiveKey: mollieKey.startsWith('live_'),
      keyPrefix: mollieKey.slice(0, 10) + '***',
      connectionError: mollieError,
    },
    ga4: {
      configured: !!ga4Secret,
      status: !ga4Secret ? '⚠️ Not configured' : '✅ Configured',
    },
    resend: {
      configured: !!resendKey,
      status: !resendKey ? '⚠️ Not configured' : '✅ Configured',
    },
  };

  const allLive = mollieKey.startsWith('live_') && checks.ga4.configured && checks.resend.configured;

  return res.status(200).json({
    status: allLive ? '✅ PRODUCTION LIVE KEYS' : '❌ TEST OR MISSING KEYS',
    checks,
    production_ready: allLive,
    timestamp: new Date().toISOString(),
  });
}
