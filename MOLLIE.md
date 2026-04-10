# Mollie integration — operator's guide

This document is the runbook for the Mollie donation flow. **Read it before
touching any payment-related code or before the DNS cutover.**

## What's where

| File | Purpose |
|---|---|
| `api/create-donation.ts` | Vercel serverless. POSTed by the donate form. Creates a Mollie payment (one-time or first recurring) and returns the checkout URL. |
| `api/mollie-webhook.ts` | Vercel serverless. Mollie POSTs here on every payment status change. Idempotently creates the Subscription after the first payment is confirmed paid. |
| `src/pages/donate.astro` | Replaces the cloned WordPress `/donate` page. Custom form posting to `/api/create-donation`. |
| `src/pages/donate/thank-you.astro` | Mollie redirects here after checkout. |
| `scripts/update-legacy-webhooks.ts` | One-shot script. Run once before DNS cutover to repoint the existing 70 GiveWP subscriptions' webhook URLs at the Cloudways subdomain. |

## Mollie organisation layout

We deliberately use **two separate Mollie organisations**:

- **LEGACY org** — created originally for GiveWP (WordPress plugin). Holds all
  ~70 active recurring subscriptions. We do not modify subscription data here
  except for one one-shot script: `scripts/update-legacy-webhooks.ts`.
- **NEW org** — created for the Astro site. All new donations from
  `/donate` create customers and subscriptions here. The legacy org and new
  org share no data.

This separation means a bug in our new code can never break an existing
recurring donation.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```
MOLLIE_API_KEY              test_xxx (NEW org, dev) or live_xxx (NEW org, prod)
PUBLIC_SITE_URL             https://welevelup.org or your ngrok URL in dev
MOLLIE_WEBHOOK_URL          https://welevelup.org/api/mollie-webhook (or ngrok)
MOLLIE_LEGACY_API_KEY       live_xxx (LEGACY org) — only needed for the script
MOLLIE_LEGACY_WEBHOOK_URL   the Cloudways URL where GiveWP still lives
```

For production, set the same vars in **Vercel dashboard → Settings →
Environment Variables**, scoped to Production. Never commit `.env.local`.

## Local testing

The Astro dev server (`npm run dev`) does NOT run the `api/` serverless
functions. To test the full payment flow locally you need `vercel dev`:

```bash
npm install -g vercel
vercel link        # one-time, links the folder to a Vercel project
vercel dev         # runs Astro + api/ together on http://localhost:3000
```

For Mollie to reach your webhook on localhost, expose it via ngrok:

```bash
brew install ngrok
ngrok http 3000
```

Copy the `https://....ngrok-free.app` URL into `.env.local` for both
`PUBLIC_SITE_URL` and `MOLLIE_WEBHOOK_URL` (the latter ending in
`/api/mollie-webhook`). Restart `vercel dev` so the new env is picked up.

Test card: `4242 4242 4242 4242`, any future expiry, any CVC. Mollie test mode
also supports failure simulation — see Mollie docs.

## Updating the 70 legacy subscriptions

**Run before DNS cutover:**

```bash
# Dry run first — shows what would change without modifying anything
npx tsx scripts/update-legacy-webhooks.ts --dry-run

# When the report looks right, apply
npx tsx scripts/update-legacy-webhooks.ts --apply
```

The script:
1. Reads `MOLLIE_LEGACY_API_KEY` from `.env.local`
2. Iterates every customer in the LEGACY org
3. For each active subscription, PATCHes its `webhookUrl` to
   `MOLLIE_LEGACY_WEBHOOK_URL` (Cloudways)
4. Skips subscriptions whose webhookUrl is already correct (idempotent)

After it's done you can delete `MOLLIE_LEGACY_API_KEY` from `.env.local`.

## Idempotency of the Mollie webhook

Mollie may POST the same event multiple times (retries on non-2xx, replays on
state changes). The handler is safe because it:

1. Looks up the payment fresh from Mollie's API on every call
2. Only acts if `payment.status === 'paid'`
3. For recurring first-payments, calls `customerSubscriptions.list({customerId})`
   and skips creation if an active subscription with the same amount already
   exists for that customer

No DB needed. The "did I already process this?" question is answered by
asking Mollie what subscriptions exist on the customer right now.

## Cancellation

Donors email `hello@welevelup.org`. The team cancels the subscription manually
via the **Mollie dashboard** (Customers → click customer → Subscriptions →
Cancel). No code involved. If we ever want self-serve cancellation we'll add
`api/cancel-subscription.ts` with magic-link auth, but that's deliberately out
of scope for the initial launch.

## Cutover order of operations

When you're ready to go live:

1. ✅ NEW Mollie org exists with GBP enabled
2. ✅ NEW org's `live_xxx` API key set in **Vercel env vars** (Production)
3. ✅ `vercel deploy --prod` succeeds
4. ✅ Donate flow tested end-to-end on the preview URL with the **test** key
5. ✅ Switch Vercel env to the **live** key, redeploy
6. ✅ Run `scripts/update-legacy-webhooks.ts --apply` against the LEGACY org
7. ✅ Verify Cloudways still receives webhooks (check WP `wp-admin →
   Donations` for a few minutes after step 6)
8. ✅ Update DNS for `welevelup.org` to point at Vercel
9. ✅ Set up `legacy.welevelup.org` as a subdomain pointing at Cloudways (for
   the next 12-24 months until natural churn ends the legacy subscriptions)
10. ✅ Watch Mollie dashboard for failed webhook notifications during the
    first 48h after cutover
