import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cronSecret = req.headers['x-vercel-cron-secret'];
    const envSecret = process.env.CRON_SECRET;

    if (envSecret && cronSecret !== envSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // TODO: Call donation sync for current year + historical years
    const syncedCount = 0;
    const totalAmount = 0;

    return res.status(200).json({
      ok: true,
      synced: syncedCount,
      total: totalAmount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return res.status(500).json({ error: msg });
  }
}
