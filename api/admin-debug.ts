import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const email = process.env.ADMIN_EMAIL || '(not set)';
  const password = process.env.ADMIN_PASSWORD || '(not set)';
  return res.status(200).json({
    ADMIN_EMAIL: email,
    ADMIN_EMAIL_TRIMMED: email.trim(),
    ADMIN_EMAIL_MATCH: email === email.trim(),
    ADMIN_PASSWORD_LENGTH: password === '(not set)' ? 0 : password.length,
    ADMIN_PASSWORD_TRIMMED_LENGTH: password === '(not set)' ? 0 : password.trim().length,
    ADMIN_PASSWORD_FIRST3: password === '(not set)' ? '' : password.slice(0, 3) + '***',
    ADMIN_PASSWORD_HAS_SPACES: password !== password.trim(),
  });
}
