import { Redis } from '@upstash/redis';

const KEYS = {
  donations: 'admin:donations',
  analytics: 'admin:analytics',
  seo: 'admin:seo',
  lastSync: 'admin:lastSync',
};

function cleanEnvVar(value: string): string {
  if (!value) return '';

  // Remove all quotes and backslashes from start/end
  let cleaned = value
    .replace(/^["\\'\\n\\r]+/, '')  // Strip from start
    .replace(/["\\'\\n\\r]+$/, '')  // Strip from end
    .trim();

  // If contains UPSTASH_ key name, it's a multi-var issue - extract just our part
  if (cleaned.includes('UPSTASH_')) {
    const urlMatch = cleaned.match(/https:\/\/[a-z0-9-]+\.upstash\.io/);
    if (urlMatch) return urlMatch[0];

    const tokenMatch = cleaned.match(/[a-zA-Z0-9]+$/);
    if (tokenMatch) return tokenMatch[0];
  }

  return cleaned;
}

function getRedis(): Redis {
  const url = cleanEnvVar(process.env.UPSTASH_REDIS_REST_URL || '');
  const token = cleanEnvVar(process.env.UPSTASH_REDIS_REST_TOKEN || '');
  if (!url || !token) throw new Error('Redis not configured');
  return new Redis({ url, token });
}

export interface DonationData {
  totalMonth: number;
  totalYear: number;
  activeSubscribers: number;
  newThisMonth: number;
  cancelledThisMonth: number;
  byGateway: { mollie: number; gocardless: number; paypal: number };
  recentDonations: Array<{ date: string; amount: number; currency: string; type: string; gateway: string }>;
  monthlyTotals: Array<{ month: string; total: number }>;
}

export interface AnalyticsData {
  sessionsThisWeek: number;
  sessionsPrevWeek: number;
  topPages: Array<{ path: string; sessions: number }>;
  byChannel: Array<{ channel: string; sessions: number }>;
  topCountries: Array<{ country: string; sessions: number }>;
}

export interface SeoData {
  topQueries: Array<{ query: string; clicks: number; impressions: number; position: number }>;
  topPages: Array<{ page: string; clicks: number; impressions: number }>;
}

export interface AdminData {
  donations: DonationData | null;
  analytics: AnalyticsData | null;
  seo: SeoData | null;
  lastSync: string | null;
}

export async function getAdminData(): Promise<AdminData> {
  const redis = getRedis();
  const [donations, analytics, seo, lastSync] = await Promise.all([
    redis.get<DonationData>(KEYS.donations),
    redis.get<AnalyticsData>(KEYS.analytics),
    redis.get<SeoData>(KEYS.seo),
    redis.get<string>(KEYS.lastSync),
  ]);
  return { donations, analytics, seo, lastSync };
}

export async function saveDonationData(data: DonationData): Promise<void> {
  const redis = getRedis();
  await redis.set(KEYS.donations, data);
  await redis.set(KEYS.lastSync, new Date().toISOString());
}

export async function saveAnalyticsData(data: AnalyticsData): Promise<void> {
  const redis = getRedis();
  await redis.set(KEYS.analytics, data);
}

export async function saveSeoData(data: SeoData): Promise<void> {
  const redis = getRedis();
  await redis.set(KEYS.seo, data);
}
