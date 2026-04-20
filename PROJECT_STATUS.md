# Level Up — Astro Project Status

## Architecture Overview

Level Up runs **two sites in parallel**:

| System | URL | Used for |
|--------|-----|----------|
| WordPress (Give WP) | welevelup.org (main) | All public pages + old donors |
| Astro (this repo) | levelup-astro.vercel.app → welevelup.org/* (gradually) | New donation flow, campaigns, donor portal |

The Astro site is a **clone-first migration**: WordPress HTML is cloned into `src/_clone/` and Astro pages wrap it with server logic. Pages go live one at a time by pointing the domain.

---

## What's Been Built

### Donation Flow
- `/donate` — full donation form (one-time and monthly)
- Mollie payments API integration (one-time + first recurring + subscription creation)
- Gift Aid checkbox collected and stored in Mollie payment metadata
- Astro-created customers tagged with `metadata.source = 'astro'` to distinguish from Give WP donors on the same Mollie organisation

### Emails (Resend)
- `src/lib/email.ts` — branded HTML email templates
- Confirmation email sent on every paid donation (one-time or first recurring) via Mollie webhook
- Magic link email for donor portal access

### Donor Portal
- `/donor-portal` — email input form, sends magic link
- `/donor-portal/manage?token=...` — shows active subscriptions, cancel button
- `/donor-portal/cancelled` — cancellation confirmation
- Auth: stateless HMAC-SHA256 signed token (1h TTL), no database required
- Token contains: `{ email, mollieCustomerId, exp }`
- Only shows subscriptions created by Astro (not Give WP) via `source: 'astro'` filter

### API Endpoints
- `POST /api/create-donation` — creates Mollie payment/customer
- `POST /api/mollie-webhook` — handles payment events, creates subscriptions, sends emails
- `POST /api/donor-portal/request-link` — searches Mollie by email, sends magic link
- `POST /api/donor-portal/cancel` — verifies token, cancels Mollie subscription

### SEO / AI Visibility
- `public/llms.txt` — Level Up context for AI assistants
- `public/robots.txt` — allows all major AI crawlers
- FAQPage JSON-LD schema on 3 campaign pages (abortion, pregnancy in prison, media guidelines)

### UI Fixes
- Mobile nav: hamburger no longer overlaps donate button
- Mobile logo: shows `level_up_new.webp` cleanly (no colour filter)
- H1 visible on homepage (cream background, navy text, uppercase)

---

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `MOLLIE_API_KEY` | Mollie live API key |
| `MOLLIE_WEBHOOK_URL` | Full URL to `/api/mollie-webhook` |
| `RESEND_API_KEY` | Resend API key (domain verified for welevelup.org) |
| `PORTAL_SECRET` | Random 32+ char secret for magic link tokens |
| `PUBLIC_SITE_URL` | `https://welevelup.org` |

---

## Migration Plan: WordPress → Astro

### Guiding Principle
**Mollie subscriptions run autonomously** — once Give WP created a recurring subscription in Mollie, it charges automatically forever without WordPress. This means **WordPress and Give WP can be shut down immediately** without breaking any existing donor payments.

Old Give WP donors who want to cancel must email `hello@welevelup.org` (they cannot use the new portal, which only shows Astro-created subscriptions).

### Phase 1 — New Donation Flow (done ✅)
- [x] Astro donate page live
- [x] Mollie integration (replaces Give WP for new donors)
- [x] Confirmation emails via Resend
- [x] Donor portal for Astro donors (magic link auth)

### Phase 2 — Domain Switch
- [ ] Point `welevelup.org` (Cloudflare) to Vercel
- [ ] Old Give WP donation URL → redirect to Astro `/donate`
- [ ] WordPress can be shut down — old recurring Mollie subscriptions continue unaffected
- How: in Cloudflare DNS, change the A/CNAME record for `welevelup.org` to Vercel's IP, then add the domain in Vercel dashboard

### Phase 3 — Campaign Pages (ready to go live)
- [ ] `/active-campaigns/abortion-is-healthcare`
- [ ] `/active-campaigns/pregnancy-in-prison`
- [ ] `/active-campaigns/media-guidelines-domestic-abuse`
- All built in Astro — live automatically once domain is pointed

### Phase 4 — Core Pages (ready to go live)
- [ ] `/about-us`, `/who-we-are`, `/our-impact`, `/contact`
- All built in Astro

### Phase 5 — Blog
- [ ] `/blog` and individual posts
- Needs content migration: WordPress export → MDX files or headless WP API

---

## Repo Structure

```
src/
├── _clone/          # WordPress HTML snapshots (source of truth for layout)
├── components/      # Nav, Footer, shared components
├── layouts/         # Layout.astro (wraps all pages)
├── lib/
│   ├── email.ts     # Resend email templates
│   ├── extractHtml.ts # Extracts sections from WordPress clone HTML
│   └── token.ts     # HMAC-SHA256 magic link tokens
├── pages/
│   ├── api/         # Server endpoints
│   ├── active-campaigns/
│   ├── donate/
│   ├── donor-portal/
│   └── ...
public/
├── llms.txt         # AI assistant context
└── robots.txt
```
