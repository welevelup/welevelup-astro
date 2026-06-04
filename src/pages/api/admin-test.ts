import type { APIRoute } from 'astro';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    // Test environment variables
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    const mollieKey = process.env.MOLLIE_API_KEY;
    const gocardlessToken = process.env.GOCARDLESS_ACCESS_TOKEN;
    const paypalId = process.env.PAYPAL_CLIENT_ID;
    const paypalSecret = process.env.PAYPAL_CLIENT_SECRET;

    return new Response(JSON.stringify({
      status: 'test',
      environment: {
        redis_url: redisUrl ? '✅ CONFIGURED' : '❌ MISSING',
        redis_token: redisToken ? '✅ CONFIGURED' : '❌ MISSING',
        mollie_key: mollieKey ? '✅ CONFIGURED' : '❌ MISSING',
        gocardless_token: gocardlessToken ? '✅ CONFIGURED' : '❌ MISSING',
        paypal_id: paypalId ? '✅ CONFIGURED' : '❌ MISSING',
        paypal_secret: paypalSecret ? '✅ CONFIGURED' : '❌ MISSING'
      },
      message: 'Check environment variable configuration in Vercel'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
