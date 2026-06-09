import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET only' });
  }

  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const propertyId = process.env.GA4_PROPERTY_ID;
  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  return res.status(200).json({
    status: 'config_check',
    environment: {
      hasServiceAccountKey: !!serviceAccountKey,
      serviceAccountKeyFormat: serviceAccountKey ? serviceAccountKey.substring(0, 50) + '...' : 'NOT SET',
      hasPropertyId: !!propertyId,
      propertyId: propertyId || 'NOT SET',
      hasRedisUrl: !!upstashUrl,
      hasRedisToken: !!upstashToken,
    },
    instructions: {
      missing: [],
      nextStep: 'If any value is missing, configure it in Vercel Environment Variables',
    },
  });
}
