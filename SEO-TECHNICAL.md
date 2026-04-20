# Technical SEO Audit — Level Up (welevelup.org)

**Audited:** 2026-04-19
**Site:** https://welevelup.org
**Stack:** Astro (static output) + Vercel, sourced from WordPress clone
**Pages audited:**
- `/` (homepage)
- `/donate`
- `/active-campaigns/abortion-is-healthcare`
- `/active-campaigns/pregnancy-in-prison`
- `/resources/nomorelyes`
- `/blog`

**Technical score: 62 / 100**

---

## Executive Summary

The Astro rebuild is structurally sound for SEO in many areas: canonical URLs correctly point to `welevelup.org`, the sitemap integration is configured, robots.txt is clean, and structured data (NGO, VideoObject, FAQPage) is present. However, several issues require attention before launch, with the most critical being the absence of a `<viewport>` meta tag and `<meta charset>` in the Astro layout itself (these are inherited from the WordPress clone's injected `headInner` rather than declared natively), security headers are completely absent on the Vercel deployment, duplicate `<title>` and `<meta name="description">` tags exist on every page due to the headHtml injection pattern, and no IndexNow protocol is implemented.

---

## 1. Crawlability

**Status: PASS (with notes)**

### robots.txt

Location: `/Users/crojasu/Desktop/levelup/levelup-astro/public/robots.txt`

```
User-agent: *
Allow: /

Sitemap: https://welevelup.org/sitemap-index.xml
```

- All pages are open to crawlers.
- Sitemap URL points to production domain — correct.
- No Disallow rules. Consider disallowing `/api/` endpoints (`/api/create-donation`, `/api/mollie-webhook`) to prevent crawlers from hitting payment routes.

**Issues:**

| Severity | Issue |
|----------|-------|
| Medium | `/api/create-donation` and `/api/mollie-webhook` are crawlable. Add `Disallow: /api/` to robots.txt. |
| Low | No AI crawler management directives (GPTBot, Google-Extended, ClaudeBot, Bytespider). Add Disallow rules for each if content protection from LLM training is desired. |

---

## 2. Indexability

**Status: PARTIAL PASS**

### Sitemap

- Configured via `@astrojs/sitemap` in `astro.config.mjs` with `site: 'https://welevelup.org'`.
- Will auto-generate `sitemap-index.xml` and `sitemap-0.xml` at build time.
- robots.txt references `https://welevelup.org/sitemap-index.xml` — consistent.

**Issues:**

| Severity | Issue |
|----------|-------|
| High | Several pages exist that should likely be excluded from the sitemap or noindexed: `/video-proposals`, `/who-we-are-proposals`, `/resources/proposal-a`, `/resources/proposal-b`, `/resources/proposal-c` (proposal/draft pages still in the page tree). |
| Medium | The sitemap is auto-generated but there is no `lastmod` signal being passed to the sitemap integration. Static Astro sites default to build time — acceptable, but explicit `lastmod` per page would improve crawl prioritisation. |

### noindex Tags

- No `<meta name="robots" content="noindex">` tags found in the Astro layout or any audited page.
- The WordPress clone's `headInner` injects `<meta name="robots" content="follow, index, max-snippet:-1, max-video-preview:-1, max-image-preview:large"/>` — this is positive, but it comes from the cloned HTML rather than being explicitly controlled in Astro.

---

## 3. Canonical URLs

**Status: PASS**

The Layout component computes canonical URLs correctly:

```ts
const siteBase = 'https://welevelup.org';
const canonicalUrl = ogUrl ?? (siteBase + Astro.url.pathname);
```

- Canonical tags always point to `welevelup.org`, not `localhost` — correct.
- The `og:url` meta also uses the production domain.
- The WordPress clone's injected `headInner` contains its own canonical tag (`<link rel="canonical" href="index.html" />`), which is a relative path pointing to `index.html`. This clone canonical is injected before the Astro canonical, meaning there are **two `<link rel="canonical">` tags on every page**.

**Issues:**

| Severity | Issue |
|----------|-------|
| Critical | Duplicate `<link rel="canonical">` tags on every page. The clone's `headInner` contains `<link rel="canonical" href="index.html" />` (a broken relative URL pointing to the homepage clone). Astro's Layout then adds a second correct canonical. Google will interpret duplicate canonicals as a signal conflict. Strip the canonical from `headInner` in `extractHtml.ts`. |

---

## 4. Meta Tags — Titles and Descriptions

**Status: PARTIAL PASS**

### Title Tags

| Page | Astro Title | Status |
|------|------------|--------|
| `/` | `Level Up \| Feminist Campaigns for Gender Justice in the UK` | Good — 64 chars |
| `/donate` | `Support Level Up \| Donate to Feminist Campaigns in the UK` | Good — 57 chars |
| `/active-campaigns/abortion-is-healthcare` | `Abortion is Healthcare \| Level Up` | Short — 34 chars, could be more descriptive |
| `/active-campaigns/pregnancy-in-prison` | `Stop Sending Pregnant Women to Prison \| Level Up` | Good — 49 chars |
| `/resources/nomorelyes` | `#NoMoreLyes — Hair Relaxer Info Kit \| Level Up` | Good — 47 chars |
| `/blog` | `Feminist Thinking — Blog \| Level Up` | Good — 36 chars |

**Issues:**

| Severity | Issue |
|----------|-------|
| Critical | Duplicate `<title>` tags on every page. The clone's `headInner` (injected as `<Fragment set:html={headHtml} />`) contains the WordPress page title. The Astro Layout then renders a second `<title>` tag via `{title && <title>{title}</title>}`. Browsers and crawlers use the last `<title>` found (the Astro one), but this is a malformed document. Strip `<title>` from `headInner` in `extractHtml.ts`. |
| Critical | Duplicate `<meta name="description">` tags on every page for the same reason. The clone's headInner contains a WordPress-generated description; Astro adds another. |
| Critical | Duplicate OG and Twitter meta tags (`og:title`, `og:description`, `og:url`, `og:image`, `twitter:card`, etc.) — the clone's headInner injects a full set, and Layout.astro injects a second set. |
| Medium | `/active-campaigns/abortion-is-healthcare` title is only 34 characters and misses the key term "decriminalisation". Consider: `Abortion is Healthcare: Decriminalise Abortion in Britain \| Level Up`. |

### Meta Descriptions

| Page | Description | Length |
|------|-------------|--------|
| `/` | "Level Up creates digital tools and campaigns fighting for gender justice in the UK — from reproductive rights to ending violence against women." | 143 chars — good |
| `/donate` | "Every campaign started with someone like you. Support Level Up's feminist campaigns for gender justice in the UK — from abortion rights to ending violence against women." | 167 chars — slightly long |
| `/active-campaigns/abortion-is-healthcare` | "It's time the law treats abortion as healthcare. Level Up campaigns for full decriminalisation of abortion in England and Wales." | 126 chars — good |
| `/active-campaigns/pregnancy-in-prison` | "Prison will never be a safe place to be pregnant. Level Up campaigns to end the imprisonment of pregnant women and new mothers in England." | 138 chars — good |
| `/resources/nomorelyes` | "Level Up's #NoMoreLyes campaign resources: information about lye-based hair relaxers, health risks for Black women, and how to take action." | 139 chars — good |
| `/blog` | "Analysis, essays and feminist thinking from Level Up — on reproductive rights, gender-based violence, criminalisation, trans-inclusive feminism and more." | 152 chars — good |

---

## 5. Open Graph Tags

**Status: PARTIAL PASS**

The Layout.astro implements OG tags correctly for Astro-controlled content:

- `og:title`, `og:description`, `og:url`, `og:image`, `og:type`, `og:site_name` are all present.
- `twitter:card`, `twitter:site`, `twitter:title`, `twitter:description`, `twitter:image` are present.
- Default OG image: `https://welevelup.org/wp-content/uploads/2023/05/Level-Up-OG.png`

**Issues:**

| Severity | Issue |
|----------|-------|
| High | Duplicate OG meta tags (see title section above) — the clone headInner injects a full OG set from WordPress Rank Math SEO, and Layout.astro adds another. Social scrapers (Facebook, Twitter/X) typically use the first occurrence, which would be the cloned WP values rather than the Astro-controlled values. |
| Medium | No `og:image:width` or `og:image:height` on the Astro-generated OG image tag. The clone's injected tags include dimensions (1024x655) for the WP image, but the Astro tags do not. Add explicit dimensions to avoid layout shift in link previews. |
| Low | `og:locale` is missing from the Astro Layout (the WP clone injects `en_GB` but that is in the duplicate set). Add `<meta property="og:locale" content="en_GB" />` to Layout.astro. |

---

## 6. Heading Structure

**Status: PARTIAL PASS**

### Homepage (`/`)

- `<h1 class="sr-only">Level Up — Feminist Campaigns for Gender Justice in the UK</h1>` — present, screen-reader only. Good for accessibility, but the visible hero heading comes from the WordPress clone's Elementor HTML (not a native heading element). The clone's hero heading is likely a styled `div` or `<h2>`, not an `<h1>`.
- `<h2>` used for: "WHO WE ARE", "How Collective Care Can Change Society", "Finish Holloway Women's Centre", "Sign Our Petitions", "Feminist Thinking", "Join the Level Up community" — all appropriate.
- `<h3>` used for petition card titles and blog card titles — appropriate.

### `/donate`

- `<h1>Every campaign started with someone like you</h1>` — present and visible. Good.
- `<h2>` for "Supported by people like you, Level Up has…" and "Make a donation" — appropriate.

### `/active-campaigns/abortion-is-healthcare`

- `<h1>Abortion is Healthcare Campaign</h1>` — present. Good.
- Multiple `<h2>` tags: "Aim", "Why Abortion Must Be Decriminalised?", "How the Abortion Is Healthcare Campaign Began", "The journey so far", "How you can help", "Media coverage", "Support this campaign", "Join the Level Up community" — good hierarchy.
- `<h3>` used inside timeline nodes — appropriate.

### `/active-campaigns/pregnancy-in-prison`

- `<h1>Pregnancy in Prison</h1>` — present. Good.
- Multiple `<h2>` tags for each section — appropriate.
- `<h3>` for timeline sub-headings — appropriate.

### `/resources/nomorelyes`

- `<h1 id="nr-hero-heading">Relaxer Info Kit</h1>` — present, with proper `aria-labelledby`. Good.

### `/blog`

- No explicit `<h1>` in the Astro source — the blog page renders `<h1 class="bl-title">Feminist Thinking</h1>` via CSS class but it is a genuine `<h1>` element. Good.
- `<h2>` for the featured post title — appropriate.
- `<h3>` for secondary post titles — appropriate.

**Issues:**

| Severity | Issue |
|----------|-------|
| Medium | Homepage: The visible hero heading is inside the WordPress clone's Elementor markup (`mainContent`), which is a `div`-based Elementor widget, not a semantic heading. The sr-only `<h1>` compensates for accessibility but the visual hierarchy has no native `<h1>` in the rendered viewport. |
| Low | `/active-campaigns/abortion-is-healthcare`: Title of the campaign page is "Abortion is Healthcare Campaign" (34 chars). The `<h1>` does not include the year or country context, making it less competitive for search queries like "decriminalise abortion UK". |

---

## 7. Viewport and Charset

**Status: CONDITIONAL PASS — risky dependency**

- `<meta charset="UTF-8">` is present in the WordPress clone's `_clone/index.html` at line 4.
- `<meta name="viewport" content="width=device-width, initial-scale=1">` is present at line 5 of the same file.
- These tags are injected into every page via `headInner` from `extract(rawHtml)`.
- The Astro `Layout.astro` file does NOT independently declare these tags.

**Issues:**

| Severity | Issue |
|----------|-------|
| Critical | `<meta charset="UTF-8">` and `<meta name="viewport">` are not declared in `Layout.astro`. They are inherited from the WordPress clone's `headInner`. If the clone HTML is ever updated or the extraction changes, these tags could silently disappear, breaking rendering on all pages. Declare both tags natively in `Layout.astro` and strip duplicates from `headInner`. |

---

## 8. Internal Linking

**Status: PASS**

The site has strong internal linking patterns:

- Navigation mega-menu links to all major campaign pages, resource pages, blog, about, press, contact, and donate.
- Homepage petition cards link to both external petition platform and internal campaign pages.
- Campaign pages link to related blog posts, donate page, and petition action.
- Blog listing links to individual blog posts.
- Footer includes contact and social links.

**Issues:**

| Severity | Issue |
|----------|-------|
| Low | The nav "Blog" dropdown hard-codes three specific blog post URLs alongside "All posts". These will become stale as new posts are added. Consider dynamic generation. |
| Low | The homepage blog section hard-codes six specific post URLs. Same staleness risk. |
| Low | Some anchor text is generic ("Read →", "Learn more →"). Where possible use descriptive anchor text that includes the campaign name. |

---

## 9. Security Headers

**Status: FAIL**

No `vercel.json` file exists in the project root. This means Vercel is serving the site with default headers only. The following security headers are absent:

| Header | Status |
|--------|--------|
| `Strict-Transport-Security` | Missing |
| `X-Content-Type-Options` | Missing |
| `X-Frame-Options` | Missing |
| `Referrer-Policy` | Missing |
| `Permissions-Policy` | Missing |
| `Content-Security-Policy` | Missing |

**Issues:**

| Severity | Issue |
|----------|-------|
| High | No `Strict-Transport-Security` header. Add `max-age=31536000; includeSubDomains; preload`. |
| High | No `X-Content-Type-Options: nosniff`. Allows MIME-type sniffing attacks. |
| High | No `X-Frame-Options: DENY` (or `SAMEORIGIN`). The site could be embedded in iframes by third parties. |
| High | No `Referrer-Policy`. Outbound clicks (to petition platforms, external press) leak the full referrer URL. Use `strict-origin-when-cross-origin`. |
| High | No `Permissions-Policy`. Browser APIs (camera, microphone, geolocation) are unrestricted. |
| Medium | No `Content-Security-Policy`. The site loads resources from `welevelup.org`, `youtube.com`, `levelup.yourmovement.org`, and `levelup.movement-action.org`. A CSP would prevent XSS and unauthorised resource loading. Note: the WordPress clone `headInner` injection makes a strict nonce-based CSP complex to implement — use a hash or allowlist approach. |

**Recommended fix — create `/Users/crojasu/Desktop/levelup/levelup-astro/vercel.json`:**

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=()" }
      ]
    }
  ]
}
```

---

## 10. Mobile / Viewport

**Status: CONDITIONAL PASS**

- `viewport` meta tag is present (via clone injection — see section 7 critical issue).
- All Astro-authored pages use responsive CSS grid with explicit mobile breakpoints (`max-width: 768px`, `max-width: 900px`).
- Touch targets appear adequately sized (nav CTAs use `padding: 16px 48px`; petition card actions use `padding: 14px 24px`).
- The site uses `clamp()` for fluid typography — positive for readability at all sizes.
- Mobile nav: hamburger menu implemented with JavaScript toggle — functional.

**Issues:**

| Severity | Issue |
|----------|-------|
| Medium | The mega-dropdown navigation is desktop-only and hidden on mobile. The mobile menu relies on JavaScript (`lu-nav-bar.open` class toggle). If JS fails to load, mobile users have no navigation. Consider a CSS-only fallback or ensure JS loads early. |
| Low | The logo image in the nav has `height: 38` set as an HTML attribute but CSS overrides to `height: 30px`. The `width` attribute is absent entirely, which can cause layout shift (CLS impact). Add explicit `width` attribute. |

---

## 11. Core Web Vitals (Source Analysis)

**Status: NEEDS ATTENTION**

Cannot run Lighthouse without Bash access, but source inspection identifies the following risk factors:

### LCP Risk

- Homepage: The hero section renders content from WordPress clone's Elementor HTML injected as `<Fragment set:html={mainContent} />`. The actual LCP element is likely a background-image CSS property on an Elementor div, which is not preloadable via `<link rel="preload">` and is invisible to browser LCP heuristics until CSS is parsed.
- Campaign pages: Hero sections use inline `style` background-image attributes (e.g., `abortion-is-healthcare.astro` line 23: `style="background-image: url('...')`). Background images cannot be preloaded with `fetchpriority="high"` — consider replacing with `<img>` elements using `loading="eager" fetchpriority="high"`.
- `/resources/nomorelyes`: Hero image uses `<img loading="eager" />` — correct.

### CLS Risk

- Nav logo: Missing `width` attribute on `<img>` (height-only attribute set). Will cause layout shift.
- Footer logo: `width="175"` and explicit height set — good.
- Homepage petition card images: `height: 210px` fixed in CSS with `object-fit: cover` — stable.
- Timeline images on campaign pages: `height: auto` with `max-height: 420px` — no explicit dimensions, possible CLS.

### INP Risk

- Mobile nav dropdown uses a JS click handler. If the main thread is busy parsing the large WordPress clone CSS bundles served from `public/wp-content/uploads/elementor/css/`, interaction delay could exceed 200ms.
- The homepage inline `<script>` (DOM manipulation of Elementor elements, MutationObserver, image lazy-loading polyfill) runs synchronously on page load and could delay INP.

**Issues:**

| Severity | Issue |
|----------|-------|
| High | Homepage hero LCP element is a CSS background image inside Elementor markup — not preloadable. Consider wrapping the hero image in a native `<img fetchpriority="high">` element. |
| High | Campaign page heroes use inline style `background-image` — same preload limitation. Replace with `<img>` for the hero to enable `fetchpriority="high"`. |
| High | The Elementor CSS bundle (30+ CSS files in `public/wp-content/uploads/elementor/css/`) is served as separate requests. These add significant render-blocking overhead. Consider inlining critical CSS or consolidating. |
| Medium | Nav logo missing `width` attribute — CLS risk on every page. |
| Medium | Timeline images (`dp-tl-image img`) have no explicit `width`/`height` attributes and use `max-height: 420px` with `height: auto` — CLS risk on campaign detail pages. |
| Low | Homepage `<script>` runs DOM manipulation (removing Elementor sections, MutationObserver) synchronously — could delay INP on low-end devices. Move non-critical work inside `requestIdleCallback`. |

---

## 12. Structured Data

**Status: PASS**

Three schema types are implemented:

### NGO Schema (Layout.astro — sitewide)

Present on all pages via Layout.astro. Includes:
- `@type: NGO`
- `name`, `alternateName`, `url`, `logo`, `description`, `foundingDate`, `email`, `address`, `sameAs` (Facebook, Twitter, Instagram)

Well-formed. No issues.

### VideoObject Schema (Homepage)

Present on the homepage for the TEDxLondon video. Includes `name`, `description`, `thumbnailUrl`, `uploadDate`, `embedUrl`, `publisher`. Well-formed.

### FAQPage Schema (`/resources/nomorelyes`)

Six Q&A pairs present. Well-formed. Will generate FAQ rich results in Google Search.

### CollectionPage Schema (`/resources/nomorelyes`)

Present alongside FAQPage. Well-formed.

**Issues:**

| Severity | Issue |
|----------|-------|
| Low | Campaign pages (`abortion-is-healthcare`, `pregnancy-in-prison`) have no structured data beyond the sitewide NGO schema. Consider adding `WebPage` or `Article` schema with `datePublished` and `author` for campaign pages, which could improve rich result eligibility. |
| Low | Blog post pages (`/blog/[slug].astro`) are not covered in this audit but likely lack `Article` structured data. |

---

## 13. JavaScript Rendering

**Status: PASS (SSG)**

- `output: 'static'` in `astro.config.mjs` — all pages are pre-rendered at build time.
- Pages are SSG (Static Site Generated) — no client-side rendering dependency for core content.
- Googlebot can index all page content without executing JavaScript.
- JavaScript is used only for progressive enhancement: nav toggle, donate form, image lazy-load polyfill, Elementor cleanup.

**Issues:**

| Severity | Issue |
|----------|-------|
| Low | The WordPress clone JavaScript files (`public/wp-includes/js/dist/*.min.js`) are shipped with the static build. Files like `core-data.min.js`, `keyboard-shortcuts.min.js`, `redux-routine.min.js` are WordPress block editor dependencies that serve no purpose on this static Astro site and add unnecessary weight. |

---

## 14. IndexNow Protocol

**Status: FAIL — Not implemented**

IndexNow allows instant URL submission to Bing, Yandex, and Naver on content changes. No IndexNow key file was found in the `public/` directory, and no IndexNow submission logic exists.

**Issues:**

| Severity | Issue |
|----------|-------|
| Low | IndexNow is not implemented. For a static site on Vercel, add a key file to `public/` (e.g., `public/{key}.txt`) and configure post-deploy webhook or CI step to submit changed URLs to `https://api.indexnow.org/indexnow`. |

---

## Prioritised Issue List

### Critical

1. **Duplicate `<link rel="canonical">`** — Clone's `headInner` injects `<link rel="canonical" href="index.html" />` (broken relative URL) on every page. Astro Layout adds a second correct canonical. Fix: strip `<link rel="canonical">` from `headInner` inside `extractHtml.ts`.

2. **Duplicate `<title>` tags** — Clone's headInner + Astro Layout both emit `<title>`. Fix: strip `<title>` from `headInner` in `extractHtml.ts`.

3. **Duplicate `<meta name="description">` and all OG/Twitter meta tags** — Same root cause as above. Strip all SEO meta tags from headInner; let Astro Layout own them entirely.

4. **`<meta charset>` and `<meta name="viewport">` not natively declared in Layout.astro** — Currently depend on clone injection. Declare both tags natively in Layout.astro as the first elements inside `<head>` (before `<Fragment set:html={headHtml} />`).

### High

5. **No security headers** — Vercel serves the site with no HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, or Permissions-Policy. Create `vercel.json` with headers block (template above).

6. **Hero images use CSS background-image** — LCP element on homepage and campaign pages is not preloadable. Replace hero backgrounds with native `<img fetchpriority="high">` elements.

7. **Elementor CSS bundle overhead** — 30+ separate CSS files from the WordPress clone are served. Consolidate or remove unused files.

8. **Draft/proposal pages publicly indexed** — `/video-proposals`, `/who-we-are-proposals`, `/resources/proposal-a`, `/resources/proposal-b`, `/resources/proposal-c` are live and will be included in the sitemap. Add `noindex` to these pages or exclude from the Astro page tree.

### Medium

9. **API routes crawlable** — Add `Disallow: /api/` to `public/robots.txt`.

10. **Nav logo missing `width` attribute** — CLS risk on every page.

11. **Timeline images lack explicit dimensions** — CLS risk on campaign detail pages.

12. **`og:image` missing width/height in Astro Layout** — Add explicit dimensions to Astro-generated OG image tag.

13. **`og:locale` missing from Astro Layout** — Add `<meta property="og:locale" content="en_GB" />`.

14. **`/active-campaigns/abortion-is-healthcare` title too short** — 34 characters, no "decriminalisation" keyword.

### Low

15. **No IndexNow implementation** — Add key file to `public/` and configure post-deploy submission.

16. **Unused WordPress JS files shipped** — Remove `public/wp-includes/js/dist/` files that serve no purpose on the static Astro site.

17. **No AI crawler management directives** — Add Disallow rules for GPTBot, Google-Extended, ClaudeBot, Bytespider if LLM training opt-out is desired.

18. **Blog and nav links are hard-coded** — Will become stale as content grows. Consider a content collection or CMS-driven approach.

19. **No `Article` structured data on blog posts or campaign pages** — Low opportunity cost for rich result eligibility.

---

## Key Files Referenced

- `/Users/crojasu/Desktop/levelup/levelup-astro/src/layouts/Layout.astro` — canonical URL logic, OG tags, structured data, title/description rendering
- `/Users/crojasu/Desktop/levelup/levelup-astro/src/lib/extractHtml.ts` — WordPress clone head injection; duplicate tag stripping should be added here
- `/Users/crojasu/Desktop/levelup/levelup-astro/public/robots.txt` — add `Disallow: /api/`
- `/Users/crojasu/Desktop/levelup/levelup-astro/astro.config.mjs` — sitemap and site URL configuration; correct
- `/Users/crojasu/Desktop/levelup/levelup-astro/src/components/Nav.astro` — logo width attribute missing
- `/Users/crojasu/Desktop/levelup/levelup-astro/src/pages/active-campaigns/abortion-is-healthcare.astro` — hero background-image LCP issue
- `/Users/crojasu/Desktop/levelup/levelup-astro/src/pages/active-campaigns/pregnancy-in-prison.astro` — hero video background, LCP concern
