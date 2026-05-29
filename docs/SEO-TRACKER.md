# welevelup.org — SEO Tracker

Last updated: 2026-05-29
Data source: GA4 + Google Search Console (last 30 days: 28 Apr – 28 May 2026)

---

## Snapshot

| Metric | Value |
|--------|-------|
| Total sessions / month | ~1,551 |
| Organic search sessions | 390 (25%) |
| Total GSC impressions | ~7,600 |
| Total GSC clicks | ~249 |
| Overall CTR | ~3.3% |
| Top keyword position | "level up uk" — pos 1 |
| Biggest opportunity | "level up" — pos 8, 2,539 impressions, 1.69% CTR |

---

## Done ✅

| Date | Change | Impact |
|------|--------|--------|
| 2026-05-28 | Fixed `/wp-content/*` rewrite — images and logo were broken on staging | All images restored |
| 2026-05-28 | Homepage title/description rewritten for "level up" query (pos 8, 2.5k impressions) | CTR uplift expected in 4–8 weeks |
| 2026-05-28 | Pregnancy in Prison title now leads with "Pregnant Women in Prison UK" | Targets page-2/3 queries with 0 clicks |
| 2026-05-28 | Abortion is Healthcare title/description enriched with "Decriminalise Abortion in the UK" | Nudging from pos 10.9 toward page 1 |
| 2026-05-29 | Hair relaxer info kit (`/nomorelyes-relaxer-info-kit/`) — added title + description | Was pos 2–5 with ~230 impressions and 0 clicks |
| 2026-05-29 | Added OG images to both nomorelyes campaign pages | Social share previews now show campaign image |

---

## In Progress / Next Sprint ⏳

### 1. Sitemap cleanup
**Problem:** The auto-generated Astro sitemap includes cloned WordPress pages (via `[...slug].astro`) that should not be indexed — old landing pages, resource kits, WP-only pages. At the same time, some live Astro pages may be missing or HTTP WordPress URLs may still be in Google's index.

**How to implement:**
- Audit what `[...slug].astro` is generating in the sitemap — run `npm run build` and inspect `dist/client/sitemap-0.xml`
- Add a `filter` to the sitemap in `astro.config.mjs` to exclude any cloned pages that shouldn't be indexed (e.g. `/nomorelyes-relaxer-info-kit`, `/nomorelyes-open-letter`, old WP landing pages)
- Submit the cleaned sitemap to Google Search Console (GSC → Sitemaps → `https://welevelup.org/sitemap-index.xml`)
- Request removal of old HTTP URLs via GSC URL Removal tool

**Who:** Developer + approval from Catalina on which cloned pages to exclude.

---

### 2. Press page SEO
**Current state:** `/press/` has 20 sessions/month, title "Press | Level Up". Has good schema markup (99 press items as structured data). Gets almost no organic traffic.

**Opportunity:** The press page lists 99 articles from Guardian, Channel 4, BBC, Times, Metro etc. This is high-authority signal but it's all outbound — no internal authority being built. Google sees this as a list of external links, not a topical authority page.

**How to implement:**
- Improve title: `"Level Up in the Press — 99 Media Mentions | Feminist Campaigns"`
- Improve description: name the publications explicitly ("Coverage in The Guardian, Channel 4, BBC, The Times and more...")
- Add introductory editorial copy above the press list (2–3 paragraphs on what each campaign achieved in the media — this gives Google something to index)
- Add internal links from press items back to the relevant campaign pages
- Consider splitting into campaign-specific press pages (`/press/pregnancy-in-prison`, etc.) for deeper topical relevance

**Who:** Developer for code; Catalina to write or approve the editorial copy.

---

### 3. Resources pages SEO
**Current state:** 5 resource sub-pages, all have reasonable titles and descriptions. The index `/resources/` gets 59 sessions/month.

**Opportunity:** Resource pages are ideal for long-tail "download [topic] toolkit/guidelines" queries. Currently not being targeted.

**How to implement per page:**

| Page | Current title | Suggested improvement |
|------|---------------|----------------------|
| `/resources/` | Campaign Resources \| Level Up | "Free Feminist Campaign Resources \| Level Up — Toolkits, Guidelines & Research" |
| `/resources/nomorelyes` | #NoMoreLyes — Hair Relaxer Info Kit | "#NoMoreLyes Hair Relaxer Cancer Risk — Research, Toolkits & Resources \| Level Up" |
| `/resources/ddw` | Dignity for Dead Women — Campaign Resources | "Media Guidelines for Reporting Domestic Homicide \| Level Up" |
| `/resources/pregnancy-in-prison` | Pregnancy in Prison — Resources & Legal Toolkit | "Pregnant Women in Prison — Free Legal Toolkit & Resources \| Level Up" |
| `/resources/abortion-is-healthcare` | Abortion is Healthcare — Resources & Media Guidelines | "Abortion Media Guidelines UK — Free Download \| Level Up" |

Each page also needs 1–2 introductory paragraphs above the resource list to give Google content to index.

**Who:** Developer for meta changes (quick, no approval needed per previous agreement); editorial copy needs Catalina's sign-off.

---

### 4. "level up london" content gap
**Data:** 26 impressions, position 5.0, 0 clicks — close to getting traffic but nothing to land on.
**Fix:** Add a London section to the homepage or a dedicated `/london` page mentioning Level Up's London presence, protests, and events.
**Who:** Catalina to decide if/how to represent London activity; developer to implement.

---

### 5. Internal linking — Pregnancy in Prison
**Data:** Page gets 63 active users/month with excellent engagement (11% bounce). Ranks page 2–3 for "pregnant in prison" — needs authority push.
**Fix:** Add 2–3 contextual links from the homepage, relevant blog posts, and the resources page pointing to `/active-campaigns/pregnancy-in-prison/`.
**Who:** Developer — quick change, no content change needed.

---

## Bigger Picture 🔭

### Donation flow
**What we know:** `/donate/` gets 149 sessions/month, 10.7% bounce rate. That low bounce rate means people who arrive are highly engaged — they scroll, they read.

**What we don't know:** How many actually complete a donation. The Mollie integration tracks payments but there is no conversion event flowing back to GA4 currently.

**Scope to implement:**
1. Fire a GA4 `purchase` event from the Mollie webhook when a donation succeeds (the webhook at `/api/mollie-webhook.ts` already exists — add `ga_send_purchase` MCP call or a Measurement Protocol hit)
2. Set up a GA4 conversion goal for the donate page
3. Once conversion data exists, optimise the donate page CTA, copy, and amounts based on real data
4. A/B test suggested amounts (currently unknown what's shown)

**Effort:** Medium — 1–2 days developer work to wire up GA4 conversion tracking from the webhook.

---

### Email capture
**What we know:** The site drives all sign-ups to `yourmovement.org/p/join-us` (external). No emails are captured natively on welevelup.org. Organic Social is only 2.5% of traffic.

**Scope to implement (option A — quick):**
- Add an inline email capture form to the homepage and campaign pages that submits to the yourmovement.org API or a Mailchimp/ConvertKit list
- This keeps people on-site and lets us track form submissions in GA4

**Scope to implement (option B — fuller):**
- Build a native subscriber list on welevelup.org backed by a simple email service (Mailchimp, Kit, Loops)
- Trigger welcome email sequence from the Astro API routes (already have email infrastructure in `src/lib/email.ts`)
- Send campaign updates from the welevelup.org domain for better deliverability

**Decision needed from Catalina:** Which email platform to use, and whether to keep yourmovement.org as the primary or migrate.

---

## Metrics to Watch

Check these in GSC + GA4 in 4 weeks (by ~28 June 2026):

| Keyword | Current | Target |
|---------|---------|--------|
| "level up" | pos 8, 1.69% CTR | pos 6–7, 3%+ CTR |
| "pregnant in prison" | pos 14.4, 0 clicks | pos 8–10, first clicks |
| "pregnant women in prison" | pos 24.4, 0 clicks | pos 15–20 |
| "abortion is healthcare" | pos 10.9, 0 clicks | pos 7–9, first clicks |
| "hair relaxer cancer risk" | not ranking | appears in top 15 |

---

## Update Log

| Date | Who | Update |
|------|-----|--------|
| 2026-05-29 | Claude + Catalina | Initial tracker created. SEO meta changes live on production. |

