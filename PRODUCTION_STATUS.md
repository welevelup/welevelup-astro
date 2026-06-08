# LevelUp Astro - Production Status (June 8, 2026)

## ✅ STABLE BUILD - All Systems Operational

This document marks a stable checkpoint after fixing critical issues with the admin dashboard.

### What Works

**Authentication**
- Admin login with credentials (`tech@welevelup.org` / `LevelUp2026!`)
- Sessions stored in Redis with 24h TTL
- Token persists across navigation (Dashboard → SEO → Analytics → Dashboard)
- Logout works correctly

**Dashboard Features**
- Donation data from Mollie, GoCardless, PayPal
- Manual sync via "Refresh Data" button on all pages
- SEO data from Google Search Console
- Analytics data from Google Analytics 4

**API Endpoints** (all working)
- POST `/api/admin-auth` - Login (creates Redis session)
- POST `/api/admin-sync` - Sync donations (accepts token in URL)
- POST `/api/admin-seo-sync` - Sync SEO data (accepts token in URL)
- POST `/api/admin-analytics-sync` - Sync GA4 data (accepts token in URL)
- POST `/api/mollie-webhook` - Webhook endpoint (live)
- DELETE `/api/admin-auth` - Logout

### Recent Fixes (This Session)

1. **Endpoint routing** - Restored from `src/pages/api/` to root `api/` (Vercel Functions)
2. **Login flow** - Token stored in localStorage + passed in URL query params
3. **Navigation** - Token persists when clicking between pages
4. **Refresh buttons** - All three sync endpoints accept token as query param
5. **Middleware** - Checks: URL token OR session cookie OR Vercel Cron header

### Architecture

```
Login → Token in localStorage + URL → Navigate pages (token stays in URL) → Refresh button uses token
```

**Token Flow:**
1. User logs in → POST `/api/admin-auth` with credentials
2. Server creates Redis session, returns token
3. Client stores in localStorage + redirects with token in URL
4. Middleware validates: URL token OR Redis session OR Cron header
5. Navigation links pass token in URL
6. Refresh buttons retrieve token and pass to sync endpoints

### Next: Webhook Verification

⚠️ **TODO:** Verify Mollie webhook is configured in Mollie Dashboard

1. Log in to Mollie Dashboard
2. Go to Developers → Webhooks
3. Ensure webhook URL is set to `https://welevelup.org/api/mollie-webhook`
4. Test with a payment to confirm notifications arrive

### Key Files Modified

- `api/admin-auth.ts` - Auth endpoint
- `api/admin-sync.ts` - Donation sync (now accepts URL token)
- `api/admin-seo-sync.ts` - SEO sync (now accepts URL token)
- `api/admin-analytics-sync.ts` - Analytics sync (now accepts URL token)
- `src/pages/levelup/login.astro` - Login page
- `src/pages/levelup/dashboard.astro` - Dashboard with token in nav links
- `src/pages/levelup/seo.astro` - SEO page with token in nav links
- `src/pages/levelup/analytics.astro` - Analytics page with token in nav links
- `src/middleware.ts` - Auth guard

### Environment Variables (Required)

```
ADMIN_EMAIL=tech@welevelup.org
ADMIN_PASSWORD=LevelUp2026!
UPSTASH_REDIS_REST_URL=https://[...].upstash.io
UPSTASH_REDIS_REST_TOKEN=[token]
MOLLIE_API_KEY=live_[key] (production) or test_[key] (staging)
MOLLIE_WEBHOOK_URL=https://welevelup.org/api/mollie-webhook
PAYPAL_CLIENT_ID=[id]
PAYPAL_CLIENT_SECRET=[secret]
GOOGLE_SERVICE_ACCOUNT_KEY=[json]
GA4_PROPERTY_ID=[id]
```

### Testing Checklist

- [x] Login works
- [x] Navigation preserves token
- [x] Refresh buttons work without "Unauthorized"
- [x] Logout works
- [x] PayPal donations show (302 confirmed)
- [x] SEO page loads
- [x] Analytics page loads
- [ ] Mollie webhook configured (TODO)
- [ ] Test payment triggers webhook

---

**Deployed:** `main` branch on Vercel (welevelup.org)  
**Staging:** `staging` branch on Vercel (staging.welevelup.org)  
**Last Updated:** 2026-06-08 12:45 UTC
