import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const email = process.env.ADMIN_EMAIL || '(not set)';
  const password = process.env.ADMIN_PASSWORD || '(not set)';
  return res.status(200).json({
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_LENGTH: password === '(not set)' ? 0 : password.length,
    ADMIN_PASSWORD_FIRST3: password === '(not set)' ? '' : password.slice(0, 3) + '***',
  });
}
