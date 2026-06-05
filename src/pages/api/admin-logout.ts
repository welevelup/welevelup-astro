import type { APIRoute } from 'astro';
import { deleteSession } from '../../lib/session';

export const POST: APIRoute = async ({ request }) => {
  const cookies = request.headers.get('cookie') ?? '';
  const match = cookies.match(/admin_session=([^;]+)/);
  const token = match?.[1];

  if (token) {
    deleteSession(token);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': 'admin_session=; Path=/; Max-Age=0',
    },
  });
};
