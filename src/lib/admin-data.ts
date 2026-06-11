import { Redis } from '@upstash/redis';

const KEYS = {
  donations: 'admin:donations',
  analytics: 'admin:analytics',
  seo: 'admin:seo',
  audience: 'admin:audience',
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

// Derived donor insights. All optional so pages tolerate older cached payloads.
export interface DonorInsights {
  mrr: number;
  avgMonthlyGift: number;
  avgOneOffGift: number;
  splitPct: { recurring: number; oneOff: number };
  giftSizeBuckets: Array<{ bucket: string; count: number; amount: number }>;
  subscriberFlows: Array<{ month: string; joined: number; churned: number; net: number }>;
  /** Per-donor detail behind "lost donors" for the last complete month. */
  lostDonorsDetail?: Array<{
    donor: string;
    gateway: string;
    amount: number;
    lastGift: string;
    reason: 'failed' | 'cancelled' | 'no_charge';
  }>;
  lostDonorsMonth?: string;
  /** Quarterly/yearly givers — excluded from monthly counts, shown separately. */
  otherRecurring?: { total: number; quarterly: number; yearly: number };
  repeatOneOffDonors: number;
}

export interface DonationData {
  /** Previous month's takings cut at today's day-of-month — the honest
   *  comparison for the in-progress "raised this month" figure. */
  prevMonthToDate?: number;
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
  donorInsights?: DonorInsights;
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
  // Newer cross-cut insight fields (optional for cache tolerance).
  donationsByChannel?: Array<{ channel: string; donations: number; revenue: number }>;
  funnel?: { sessions: number; donateViews: number; donations: number };
  landingPages?: Array<{ landingPage: string; sessions: number; users: number }>;
  newVsReturning?: { new: number; returning: number };
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
  // Newer actionable insight fields (optional for cache tolerance).
  opportunities?: Array<{ query: string; impressions: number; clicks: number; ctr: number; position: number }>;
  positionBuckets?: Array<{ bucket: string; impressions: number; pct: number }>;
  gainedLost?: {
    gained: Array<{ query: string; clicks: number }>;
    lost: Array<{ query: string; clicks: number }>;
  };
}

// Audience map data. Written by scripts/sync-audience-data.ts — district-level
// aggregates only (no full postcodes, no PII). All fields optional so the page
// tolerates older cached payloads.
export interface AudienceDistrict {
  district: string;
  lat: number | null;
  lng: number | null;
  total: number;
  bySource: Record<string, number>;
  topSource: string;
}

export interface AudienceData {
  districts?: AudienceDistrict[];
  bySource?: Array<{ source: string; count: number }>;
  monthly?: Array<{ month: string; count: number }>;
  totalPeople?: number;
  totalDistricts?: number;
  geocodedPct?: number;
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

export async function getAudienceData(): Promise<AudienceData | null> {
  const redis = getRedis();
  return redis.get<AudienceData>(KEYS.audience);
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
