# Donation System Documentation

## Overview

Level Up's donation system is fully integrated with:
- **Mollie** for payment processing (Live & Test modes)
- **Google Analytics 4** for conversion tracking and revenue metrics
- **Resend** for email confirmations
- **Admin Dashboard** for revenue visualization

## Payment Flow

```
User → Donation Page (src/pages/donate.astro)
  ↓
Create Payment (POST /api/create-donation)
  ├─ Generate validation token
  ├─ Create Mollie payment
  └─ Save token to sessionStorage
  ↓
Mollie Checkout (Hosted)
  ↓
Payment Success/Failure
  ├─ Success → Mollie redirects to /donate/thank-you?amount=X&type=Y
  ├─ Failure → User returns to donation page
  └─ Webhook → /api/mollie-webhook (processes payment, sends email, GA4 event)
  ↓
Thank You Page (src/pages/donate/thank-you.astro)
  ├─ Validates sessionStorage token
  ├─ Redirects to /donate if no token
  └─ Displays confirmation + GA4 purchase event
```

## Security Features

### 1. Thank-You Page Protection
- **Token Validation**: Only accessible after a valid payment
- **SessionStorage**: Token is generated per payment and stored client-side
- **Auto-Cleanup**: Token is cleared after page loads
- **Manual Access Prevention**: Direct URL access redirects to /donate

**Implementation:**
```javascript
// In donate.astro: Save token before Mollie redirect
sessionStorage.setItem('levelup_payment_token', data.validationToken);

// In thank-you.astro: Verify token on page load
const paymentToken = sessionStorage.getItem('levelup_payment_token');
if (!paymentToken) window.location.href = '/donate';
sessionStorage.removeItem('levelup_payment_token');
```

### 2. Back Button Behavior
- **History State**: Uses `window.history.replaceState()` to replace the Mollie redirect entry
- **UX**: Back button goes to donation page, not thank-you
- **No Validation**: User sees donation page, not blocked thank-you

**Implementation:**
```javascript
// Replace history entry so back button doesn't show thank-you
window.history.replaceState({}, document.title, window.location.href);
```

### 3. Webhook Security
- **Event Verification**: Checks payment status before processing
- **Metadata Validation**: Verifies donor email, amount, type
- **Idempotency**: Handles duplicate webhook calls gracefully
- **Resource Detection**: Detects payment type by ID prefix (tr_ = payment, sub_ = subscription)

## Key Files

### Payment Creation
- **File**: `api/create-donation.ts`
- **Endpoint**: `POST /api/create-donation`
- **Generates**: 
  - Mollie payment with redirectUrl + webhookUrl
  - ValidationToken for sessionStorage
  - PaymentId cookie (HttpOnly, 1 hour expiry)

### Thank-You Page
- **File**: `src/pages/donate/thank-you.astro`
- **Validation**: SessionStorage token check
- **Actions**:
  - Verifies amount > 0
  - Checks sessionStorage token
  - Tracks GA4 purchase event
  - Replaces browser history

### Webhook Processing
- **File**: `api/mollie-webhook.ts`
- **Handles**:
  - Payment status updates
  - Email confirmation (Resend)
  - GA4 event tracking (Measurement Protocol)
  - Recurring subscription creation

### Admin Revenue Dashboard
- **File**: `api/admin-analytics-sync.ts`
- **Fetches**: GA4 purchaseRevenue metric
- **Updates**: Redis cache for admin dashboard
- **Metric**: `purchaseRevenue` from GA4 API

## Environment Variables

### Required (Production)
- `MOLLIE_API_KEY` - Live API key (starts with `live_`)
- `MOLLIE_WEBHOOK_URL` - Full webhook URL (e.g., https://welevelup.org/api/mollie-webhook)
- `GA4_MEASUREMENT_ID` - GA4 property measurement ID
- `GA4_API_SECRET` - GA4 Measurement Protocol API secret
- `RESEND_API_KEY` - Resend email service API key
- `PORTAL_SECRET` - Secret for donor portal token signing
- `PUBLIC_SITE_URL` - Site URL (e.g., https://welevelup.org)

### Optional (Admin Features)
- `GOOGLE_SERVICE_ACCOUNT_KEY` - For GA4 analytics fetch
- `GA4_PROPERTY_ID` - For GA4 analytics fetch

## Testing Endpoints

- `GET /api/check-live-keys` - Verify all API credentials are configured
- `GET /api/test-mollie` - Test Mollie API connection
- `GET /api/test-ga4` - Test GA4 Measurement Protocol
- `POST /api/test-webhook` - Simulate Mollie webhook
- `POST /api/test-email` - Test Resend email sending

## CSP Headers

The following CSP directives allow the donation system to function:

```
form-action 'self' https://app.mollie.com;
frame-src https://www.youtube.com https://www.youtube-nocookie.com https://challenges.cloudflare.com;
connect-src 'self' https://*.google-analytics.com https://www.facebook.com https://connect.facebook.net;
script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://connect.facebook.net https://www.facebook.com;
```

## Email Confirmations

Emails are sent via Resend after successful payment:
- **Template**: HTML-based with Level Up branding
- **Contents**: Donation amount, monthly/one-time type, Gift Aid status
- **Link**: Donor portal link (for recurring donors)
- **Timing**: After webhook processes payment (usually instant)

## GA4 Integration

### Client-Side (thank-you.astro)
```javascript
gtag('event', 'purchase', {
  currency: 'GBP',
  value: amount,
  transaction_id: 'donation-' + timestamp,
  items: [{ item_id, item_name, price, quantity: 1 }]
});
```

### Server-Side (mollie-webhook.ts)
```
POST https://www.google-analytics.com/mp/collect
- Event: 'purchase'
- Revenue: Donation amount
- TransactionID: Mollie payment ID
- Items: Donation type (monthly/one-time)
```

### Admin Dashboard (admin-analytics-sync.ts)
- Fetches `purchaseRevenue` metric from GA4 API
- Caches in Redis
- Displays in admin dashboard as total monthly revenue

## Donor Portal

### Request Access
- **Page**: `/donor-portal`
- **Endpoint**: `POST /api/donor-portal/request-link`
- **Flow**:
  1. User enters email
  2. System looks up Mollie customer
  3. Sends secure link (valid 1 hour)
  4. Link contains HMAC-signed token

### Manage Donations
- **Page**: `/donor-portal/manage?token=...`
- **Endpoint**: `POST /api/donor-portal/cancel`
- **Actions**: Cancel subscription via Mollie API

## Deployment

### Staging
- `MOLLIE_API_KEY`: Test key (tr_...)
- `MOLLIE_WEBHOOK_URL`: https://staging.welevelup.org/api/mollie-webhook
- Test payments via Mollie dashboard

### Production
- `MOLLIE_API_KEY`: Live key (live_...)
- `MOLLIE_WEBHOOK_URL`: https://welevelup.org/api/mollie-webhook
- Real payments processed
- Revenue tracked in GA4

## Troubleshooting

### Payment not redirecting to thank-you
- Check `MOLLIE_WEBHOOK_URL` in Vercel env vars
- Verify webhook is configured in Mollie dashboard
- Check browser console for sessionStorage errors

### Revenue showing £0 on dashboard
- Verify GA4 purchase events in GA4 real-time report
- Check `GA4_MEASUREMENT_ID` and `GA4_API_SECRET` are correct
- Check `GOOGLE_SERVICE_ACCOUNT_KEY` has analytics.readonly scope

### Email not sending
- Verify `RESEND_API_KEY` is correct
- Check domain verification in Resend
- Verify donor email is valid in payment metadata

### Back button shows thank-you
- Ensure `history.replaceState()` is running in thank-you.astro
- Check browser history entries (F12 → Application → Session Storage)

## Recent Changes

### June 9, 2026
- Added sessionStorage token validation to prevent direct thank-you access
- Ensured back button behavior works correctly with history.replaceState()
- All integrations verified working in production
- System live at welevelup.org

---

**Last Updated**: June 9, 2026
**Status**: ✅ Production Ready
