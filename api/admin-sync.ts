import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // TODO: Implement actual donation sync (Mollie, GoCardless, PayPal)
    // Placeholder response
    const syncedCount = 0;
    const totalAmount = 0;

    return res.status(200).json({
      ok: true,
      message: 'Sync endpoint ready for implementation',
      synced: syncedCount,
      total: totalAmount,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('Sync error:', msg);
    return res.status(500).json({ error: msg });
  }
}
