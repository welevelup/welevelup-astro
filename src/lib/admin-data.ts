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

export interface MonthlyTotal {
  month: string;
  total: number;
  monthly_donations: number;
  one_off_donations: number;
  active_subscribers: number;
  mollie_count: number;
  gocardless_count: number;
  paypal_count: number;
  failed_payments: number;
  failed_amount: number;
  failed_mollie: number;
  failed_gocardless: number;
  failed_paypal: number;
  cancelled: number;
  cancelled_amount: number;
  cancelled_mollie: number;
  cancelled_gocardless: number;
  cancelled_paypal: number;
  total_lost: number;
}

export interface DonationData {
  totalMonth: number;
  totalYear: number;
  activeSubscribers: number;
  newThisMonth: number;
  cancelledThisMonth: number;
  byGateway: { mollie: number; gocardless: number; paypal: number };
  recentDonations: Array<{ date: string; amount: number; currency: string; type: string; gateway: string; status?: string }>;
  cancelledSubscriptions?: Array<{ date: string; amount: number; currency: string; gateway: string; payer: string }>;
  failedTransactions?: Array<{ date: string; amount: number; currency: string; gateway: string; payer: string }>;
  monthlyTotals: MonthlyTotal[];
}

// Shapes below mirror what the sync endpoints write. All newer fields are optional
// so pages can tolerate older cached payloads without crashing.
export interface AnalyticsData {
  users?: number;
  sessions?: number;
  avgSessionDuration?: number;
  bounceRate?: number;
  conversionRate?: number;
  donationEvents?: number;
  revenue?: number;
  topPages?: Array<{ path: string; users: number; sessions: number; avgDuration: number; bounceRate: number }>;
  trafficSources?: Array<{ source: string; users: number; sessions: number; avgDuration: number; bounceRate: number; percentage: number }>;
  devices?: Array<{ type: string; users: number; sessions: number; bounceRate: number }>;
  geography?: Array<{ country: string; users: number; sessions: number; bounceRate: number }>;
  daily?: Array<{ date: string; sessions: number; users: number }>;
  prevUsers?: number;
  prevSessions?: number;
  prevRevenue?: number;
  prevDonationEvents?: number;
  lastSync?: string;
}

export interface SeoData {
  topKeywords?: Array<{ query: string; clicks: number; impressions: number; position: number; ctr: number; change: number | null }>;
  topPages?: Array<{ url: string; clicks: number; impressions: number; position: number; ctr: number }>;
  devices?: Array<{ device: string; clicks: number; impressions: number; ctr: number }>;
  geography?: Array<{ country: string; clicks: number; impressions: number; ctr: number }>;
  searchAppearance?: Array<{ type: string; count: number; percentage: number }>;
  daily?: Array<{ date: string; clicks: number; impressions: number }>;
  totalClicks?: number;
  totalImpressions?: number;
  avgPosition?: number;
  avgCtr?: number;
  prevTotalClicks?: number;
  prevTotalImpressions?: number;
  prevAvgPosition?: number;
  prevAvgCtr?: number;
  lastSync?: string;
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
