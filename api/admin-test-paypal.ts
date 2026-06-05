import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const clientId = process.env.PAYPAL_CLIENT_ID || '';
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';

  if (!clientId || !clientSecret) {
    return res.status(200).json({ ok: false, error: 'Credentials not configured' });
  }

  try {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const response = await fetch('https://api-m.paypal.com/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    const data = await response.json() as any;

    return res.status(200).json({
      ok: response.ok,
      status: response.status,
      client_id_prefix: clientId.slice(0, 8) + '...',
      token_type: data.token_type,
      error: data.error,
      error_description: data.error_description,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : 'Unknown' });
  }
}
