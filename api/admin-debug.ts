import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  const email = process.env.ADMIN_EMAIL || '(not set)';
  const password = process.env.ADMIN_PASSWORD || '(not set)';

  // If POST, test the credentials directly
  if (req.method === 'POST') {
    const { email: inputEmail, password: inputPassword } = req.body ?? {};
    return res.status(200).json({
      stored_email: email,
      input_email: inputEmail,
      email_match: email.trim() === inputEmail?.trim(),
      stored_password_length: password.length,
      input_password_length: inputPassword?.length,
      password_match: password.trim() === inputPassword?.trim(),
    });
  }

  return res.status(200).json({
    ADMIN_EMAIL: email,
    ADMIN_PASSWORD_LENGTH: password === '(not set)' ? 0 : password.length,
    ADMIN_PASSWORD_FIRST3: password === '(not set)' ? '' : password.slice(0, 3) + '***',
    ADMIN_PASSWORD_HAS_SPACES: password !== password.trim(),
    ADMIN_PASSWORD_CHARS: password.split('').map(c => c.charCodeAt(0)),
  });
}
