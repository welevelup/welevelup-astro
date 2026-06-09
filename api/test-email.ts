import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    return res.status(500).json({
      status: 'error',
      message: 'RESEND_API_KEY not configured in environment variables',
    });
  }

  const testEmail = req.body?.email || 'test@example.com';

  try {
    const resend = new Resend(resendApiKey);

    const result = await resend.emails.send({
      from: 'Level Up <no-reply@welevelup.org>',
      to: testEmail,
      subject: 'Test Email from Level Up',
      html: '<h1>Test Email</h1><p>If you received this, Resend is configured correctly!</p>',
    });

    return res.status(200).json({
      status: 'success',
      message: '✅ Test email sent',
      details: {
        to: testEmail,
        resendId: result.id,
        resendApiKeyConfigured: !!resendApiKey,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to send test email',
      error: message,
      resendApiKeyConfigured: !!resendApiKey,
    });
  }
}
