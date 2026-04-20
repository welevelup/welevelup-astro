# Level Up — Astro Site Development Guide

## Overview

Astro SSR site deployed on Vercel. Handles the donation flow (Mollie payments), transactional email (Resend), and a donor portal with magic-link login.

Live URL: `https://levelup-astro-git-main-tech-8249s-projects.vercel.app`
Stable alias: `https://levelup-astro.vercel.app`

---

## Architecture

```
levelup-astro/
├── api/                        # Root-level Vercel serverless functions (Node.js)
│   ├── create-donation.ts      # POST /api/create-donation — creates Mollie payment
│   └── mollie-webhook.ts       # POST /api/mollie-webhook — handles payment events, sends email
├── src/
│   ├── pages/
│   │   ├── donate.astro        # Donation form page
│   │   ├── donate/thank-you    # Post-payment landing page
│   │   ├── donor-portal/       # Magic-link authenticated donor portal
│   │   └── api/                # Astro server routes (SSR, NOT used for webhooks)
│   └── lib/
│       └── email.ts            # Resend email helpers (magic link, donor confirmation)
└── public/
```

### Why two `api/` directories?

Vercel's routing config has a rule that sends `/api/*` requests to a 404 if no dedicated serverless function handles them — the Astro SSR bundle (`_render.func`) is blocked for API routes. Root-level `api/` functions are separate lambdas that bypass this.

Additionally, root `api/` functions **bypass Vercel BotID**, which blocks server-to-server requests (like Mollie webhooks) on the main SSR bundle.

**Rule: anything that receives server-to-server calls (webhooks) or needs to work reliably must live in `api/` at the project root.**

---

## Environment Variables

| Variable | Purpose |
|---|---|
| `MOLLIE_API_KEY` | Mollie API key — `test_xxx` for test mode, `live_xxx` for production |
| `MOLLIE_WEBHOOK_URL` | URL Mollie POSTs to on payment events — must use bypass token (see below) |
| `PUBLIC_SITE_URL` | Base URL used for redirect after Mollie checkout |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `MAGIC_LINK_SECRET` | Secret for signing donor portal magic links |

### Webhook URL format

```
https://levelup-astro-git-main-tech-8249s-projects.vercel.app/api/mollie-webhook?x-vercel-protection-bypass=<token>
```

The bypass token is permanent (set in Vercel project settings). It ensures Mollie's server-to-server POST is never blocked by Vercel protection layers.

---

## Deploy Workflow

**Never run `npm run build` for deployment.** Private env vars get compiled as `undefined` in local builds. Always use the Vercel CLI:

```bash
# 1. Pull production env vars
vercel pull --yes --environment production

# 2. Build with correct env vars
vercel build --prod

# 3. Deploy prebuilt output
vercel deploy --prod --prebuilt

# 4. Re-point the git-main alias (REQUIRED after every deploy)
vercel alias set <new-deployment-url> levelup-astro-git-main-tech-8249s-projects.vercel.app
```

The git-main alias must be re-pointed manually after each deploy because `MOLLIE_WEBHOOK_URL` and other server-to-server URLs point to it.

---

## Donation Flow

1. User fills the donation form at `/donate`
2. Frontend POSTs to `/api/create-donation` with `{ amount, recurring, donorName, donorEmail, giftAid }`
3. `create-donation.ts` creates a Mollie payment (or customer + first payment for recurring) and returns `{ checkoutUrl }`
4. Frontend redirects the user to Mollie's checkout
5. User completes payment on Mollie
6. Mollie redirects user to `PUBLIC_SITE_URL/donate/thank-you`
7. Mollie POSTs to `MOLLIE_WEBHOOK_URL` with `{ id: 'tr_xxx' }`
8. `mollie-webhook.ts` fetches the payment, checks status is `paid`, sends confirmation email via Resend
9. For recurring first payments: webhook also creates a Mollie subscription (monthly, same amount)

---

## Email System

Emails are sent via **Resend** from `no-reply@welevelup.org`.

### Templates

- `src/lib/email.ts` — used by Astro routes (donor portal magic link)
- `api/mollie-webhook.ts` — inline template used for donation confirmations

Both use the same visual style: Montserrat font, Movement-platform header/footer, logo from `levelup.yourmovement.org`, "In solidarity, Level Up" signature, purple CTA button.

### Triggered emails

| Trigger | Template | Sent by |
|---|---|---|
| Paid one-time donation | Donation confirmation | `mollie-webhook.ts` |
| Paid first recurring payment | Donation confirmation (monthly) | `mollie-webhook.ts` |
| Donor portal login request | Magic link | `src/pages/api/donor-portal/request-link.ts` |

---

## Donor Portal

Located at `/donor-portal`. Donors enter their email, receive a magic link (valid 1 hour), and can view/manage their donations.

Magic links are signed with `MAGIC_LINK_SECRET`. The portal reads Mollie subscription data to show recurring donation status.

---

## Switching Between Test and Live Mode

1. In Vercel dashboard → Settings → Environment Variables, update `MOLLIE_API_KEY`:
   - Test: `test_xxx` (from Mollie dashboard → Developers → API keys → Test)
   - Live: `live_xxx` (from Mollie dashboard → Developers → API keys → Live)
2. Run the full deploy workflow above
3. Do a real £1 test donation to verify end-to-end

---

## Next Steps

### High priority
- [ ] **Custom domain** — point `welevelup.org` (or a subdomain) to this Vercel project so donors don't see the `.vercel.app` URL
- [ ] **Mollie live webhook registration** — verify in Mollie dashboard that the live webhook URL is set correctly for existing subscriptions
- [ ] **Gift Aid** — confirm Gift Aid declaration is being captured and stored correctly for HMRC reporting
- [ ] **Donor portal** — test the full magic-link flow in production with a real donor email

### Medium priority
- [ ] **Error monitoring** — add Sentry or similar to catch webhook failures silently
- [ ] **Email deliverability** — verify SPF/DKIM records for `welevelup.org` in Resend dashboard so emails don't land in spam
- [ ] **Resend domain verification** — confirm `welevelup.org` is fully verified in Resend
- [ ] **Recurring donation management** — donor portal should let donors cancel/pause subscriptions

### Nice to have
- [ ] **Donation amount analytics** — log donation amounts to a simple store (Vercel KV or Supabase) for reporting
- [ ] **Admin view** — simple password-protected page showing recent donations
- [ ] **Accessibility audit** — run axe or Lighthouse accessibility check on the donate form
