import type { APIRoute } from 'astro';
import { checkCredentials } from '../../lib/admin-auth';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const secret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET || '';
    const credMatch = checkCredentials('catalina@welevelup.org', 'catalina');

    return new Response(JSON.stringify({
      status: 'ok',
      environment: {
        jwt_secret_configured: !!secret,
        jwt_secret_length: secret.length,
      },
      credentials: {
        email: 'catalina@welevelup.org',
        password: 'catalina',
        match: credMatch,
      },
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
