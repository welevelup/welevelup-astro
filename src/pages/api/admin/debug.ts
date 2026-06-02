import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(JSON.stringify({
    hasAdminPassword: !!(process.env.ADMIN_PASSWORD),
    adminPasswordLength: (process.env.ADMIN_PASSWORD ?? '').length,
    hasJwtSecret: !!(process.env.ADMIN_JWT_SECRET),
    nodeEnv: process.env.NODE_ENV,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
};
