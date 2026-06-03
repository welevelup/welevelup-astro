import type { APIRoute } from 'astro';

export const prerender = false;

export const POST: APIRoute = async () => {
  return new Response(JSON.stringify({ ok: true, message: 'nested admin login works' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
