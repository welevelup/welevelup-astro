import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  console.log('[webhook-debug] Raw request received');
  console.log('[webhook-debug] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[webhook-debug] Body type:', typeof req.body);
  console.log('[webhook-debug] Body:', JSON.stringify(req.body, null, 2));

  // Check for raw body
  if ((req as any).rawBody) {
    console.log('[webhook-debug] Raw body available:', (req as any).rawBody.toString());
  }

  return res.status(200).json({
    received: true,
    bodyType: typeof req.body,
    bodyKeys: req.body && typeof req.body === 'object' ? Object.keys(req.body) : null,
    headersReceived: Object.keys(req.headers),
    signatureHeader: req.headers['x-mollie-signature'] ? 'YES' : 'NO',
  });
}
