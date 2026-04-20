# SEO & Schema Audit — Level Up (welevelup.org)
**Audited:** 2026-04-19  
**Files reviewed:** Layout.astro, index.astro, donate.astro, 10 × active-campaigns/*.astro

---

## 1. Existing Schema Detection

### Layout.astro — Global NGO block (injected on every page)

```json
{
  "@context": "https://schema.org",
  "@type": "NGO",
  "name": "Level Up",
  "alternateName": "welevelup.org",
  "url": "https://welevelup.org",
  "logo": "https://welevelup.org/wp-content/uploads/2025/07/level_up_new.webp",
  "description": "...",
  "foundingDate": "2018",
  "email": "hello@welevelup.org",
  "address": { ... },
  "sameAs": [ ... ]
}
```

### index.astro — VideoObject block

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "How Collective Care Can Change Society",
  "description": "...",
  "thumbnailUrl": "https://img.youtube.com/vi/xj-alDQD2fg/maxresdefault.jpg",
  "uploadDate": "2023-03-01",
  "embedUrl": "https://www.youtube.com/embed/xj-alDQD2fg",
  "publisher": { "@type": "Organization", ... }
}
```

All other pages (campaign pages, donate.astro) have **no JSON-LD whatsoever**.

---

## 2. Schema Validation Results

### NGO block — Layout.astro

| Check | Result | Notes |
|---|---|---|
| `@context` is `https://schema.org` | PASS | Correct |
| `@type` is valid | PASS | `NGO` is a valid subtype of `Organization` |
| Required properties present | PASS | name, url present |
| `logo` is absolute URL | PASS | |
| `foundingDate` format | WARN | `"2018"` is acceptable but ISO 8601 `"2018-01-01"` is preferred |
| `sameAs` covers key socials | WARN | Missing LinkedIn if one exists; Twitter URL uses `twitter.com` not `x.com` — both resolve, no action required |
| No `telephone` | INFO | Not blocking, but adds trust signals |
| No `areaServed` | WARN | Add `"areaServed": "GB"` — Level Up is UK-specific |
| No `knowsAbout` | INFO | Optional but beneficial for E-E-A-T / AI citations |
| No `numberOfEmployees` or `nonprofitStatus` | INFO | Optional; `nonprofitStatus` strengthens NGO classification |

**Overall: PASS with minor recommended improvements.**

---

### VideoObject block — index.astro

| Check | Result | Notes |
|---|---|---|
| `@context` is `https://schema.org` | PASS | |
| `@type` is `VideoObject` | PASS | |
| `name` present | PASS | |
| `description` present | PASS | |
| `thumbnailUrl` present | PASS | Uses maxresdefault — good |
| `uploadDate` present | PASS | `2023-03-01` — valid ISO 8601 |
| `embedUrl` present | PASS | |
| `contentUrl` missing | FAIL | Google requires either `contentUrl` or `embedUrl`. `embedUrl` alone is accepted but `contentUrl` (direct video URL) significantly improves eligibility. For YouTube embeds, set `contentUrl` to the `youtu.be` share URL |
| `duration` missing | WARN | Recommended by Google for Video rich results. Format: `"PT14M32S"` |
| `publisher` present | PASS | |
| `publisher` uses `Organization` not `Person` | PASS | |

**Overall: CONDITIONAL PASS — add `contentUrl` and `duration` for full Google Video rich result eligibility.**

---

## 3. Missing Schema Opportunities

### 3a. BreadcrumbList — MISSING on all campaign pages

Every campaign page sits at `/active-campaigns/[slug]`. No BreadcrumbList schema exists anywhere. This is a straightforward win for SERP display.

**Add to each campaign page:**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://welevelup.org/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Campaigns",
      "item": "https://welevelup.org/active-campaigns/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Abortion is Healthcare",
      "item": "https://welevelup.org/active-campaigns/abortion-is-healthcare"
    }
  ]
}
```

---

### 3b. WebSite with SearchAction — MISSING

Add once to Layout.astro alongside the NGO block:

```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Level Up",
  "url": "https://welevelup.org",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://welevelup.org/?s={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```

---

### 3c. Campaign pages as CreativeWork / WebPage — MISSING

Each campaign page is substantive editorial content. Marking them as `WebPage` with `about` signals their topic to Google. The `Pregnancy in Prison` page in particular has achieved real policy wins — that E-E-A-T weight should be signalled.

**Template for campaign pages (example: Pregnancy in Prison):**

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Stop Sending Pregnant Women to Prison | Level Up",
  "description": "Prison will never be a safe place to be pregnant. Level Up campaigns to end the imprisonment of pregnant women and new mothers in England.",
  "url": "https://welevelup.org/active-campaigns/pregnancy-in-prison",
  "inLanguage": "en-GB",
  "isPartOf": {
    "@type": "WebSite",
    "name": "Level Up",
    "url": "https://welevelup.org"
  },
  "about": {
    "@type": "Thing",
    "name": "Pregnancy in prison",
    "sameAs": "https://en.wikipedia.org/wiki/Incarcerated_mothers"
  },
  "publisher": {
    "@type": "NGO",
    "name": "Level Up",
    "url": "https://welevelup.org"
  },
  "dateModified": "2026-04-01"
}
```

---

### 3d. FAQPage — RESTRICTED, but note for GEO

Level Up is a commercial-category site for Google rich results purposes (even as an NGO). Google restricted FAQPage rich results to government and healthcare sites in August 2023, so adding FAQPage will not produce a SERP rich result.

**However:** FAQPage markup is actively read by AI systems (ChatGPT, Gemini, Perplexity) for citation and answer generation. The `Abortion is Healthcare` and `Pregnancy in Prison` campaign pages contain natural FAQ content (why, how it began, aims). If Level Up prioritises GEO (Generative Engine Optimisation) / AI discoverability, adding FAQPage markup to those pages is worthwhile. Do not add it purely for Google SERP benefit.

---

### 3e. Event schema — MISSING on We Protect Us page

The `we-protect-us.astro` page references recurring bystander intervention training sessions. When sessions are scheduled, each should carry an `Event` block. Template:

```json
{
  "@context": "https://schema.org",
  "@type": "Event",
  "name": "We Protect Us: Free Bystander Intervention Training",
  "description": "Level Up's free online bystander intervention training. Learn how to safely interrupt harassment in public, at work, or in your community.",
  "startDate": "2026-05-15T18:00:00+01:00",
  "endDate": "2026-05-15T20:00:00+01:00",
  "eventStatus": "https://schema.org/EventScheduled",
  "eventAttendanceMode": "https://schema.org/OnlineEventAttendanceMode",
  "location": {
    "@type": "VirtualLocation",
    "url": "https://levelup.yourmovement.org/p/we-protect-us"
  },
  "organizer": {
    "@type": "NGO",
    "name": "Level Up",
    "url": "https://welevelup.org"
  },
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "GBP",
    "availability": "https://schema.org/InStock",
    "url": "https://levelup.yourmovement.org/p/we-protect-us"
  },
  "isAccessibleForFree": true,
  "inLanguage": "en-GB"
}
```

---

### 3f. VideoObject — We Protect Us page has a native `<video>`

The `we-protect-us.astro` page embeds a self-hosted MP4 (`in-the-edit-street_v3.2-1.mp4`). This should carry VideoObject schema:

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "Bystander Intervention: How to Interrupt a Police Stop and Search",
  "description": "Level Up and Black Protest Legal Support guide featuring Sapphire Mackintosh on using your agency to intervene in a police stop and search.",
  "thumbnailUrl": "https://welevelup.org/wp-content/uploads/2025/09/we-protect-us-2.webp",
  "contentUrl": "https://welevelup.org/wp-content/uploads/2025/08/in-the-edit-street_v3.2-1.mp4",
  "uploadDate": "2025-08-01",
  "publisher": {
    "@type": "NGO",
    "name": "Level Up",
    "url": "https://welevelup.org"
  }
}
```

---

### 3g. NoMoreLyes Parliamentary Evidence — second VideoObject

`nomorelyes-2.astro` (the authoritative version) embeds a YouTube video of the 2026 parliamentary evidence session (`KBBRQgdpSP4`). This should carry its own VideoObject:

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "#NoMoreLyes: Level Up Parliamentary Evidence on Toxic Hair Relaxers",
  "description": "Level Up presents oral evidence to the UK Parliamentary Committee on the science and regulation of hair and beauty products, focusing on toxic chemicals in hair relaxers used by Black women.",
  "thumbnailUrl": "https://img.youtube.com/vi/KBBRQgdpSP4/maxresdefault.jpg",
  "uploadDate": "2026-01-01",
  "embedUrl": "https://www.youtube.com/embed/KBBRQgdpSP4",
  "contentUrl": "https://www.youtube.com/watch?v=KBBRQgdpSP4",
  "publisher": {
    "@type": "NGO",
    "name": "Level Up",
    "url": "https://welevelup.org"
  }
}
```

---

### 3h. DonateAction on donate.astro — MISSING

The donate page has a working form but no schema. Marking it as a `DonateAction` provides machine-readable signal that the page accepts financial contributions.

```json
{
  "@context": "https://schema.org",
  "@type": "WebPage",
  "name": "Support Level Up | Donate to Feminist Campaigns in the UK",
  "url": "https://welevelup.org/donate",
  "description": "Every campaign started with someone like you. Support Level Up's feminist campaigns for gender justice in the UK.",
  "potentialAction": {
    "@type": "DonateAction",
    "name": "Donate to Level Up",
    "recipient": {
      "@type": "NGO",
      "name": "Level Up",
      "url": "https://welevelup.org"
    }
  }
}
```

---

## 4. E-E-A-T Signals Assessment

### What is present
- `foundingDate: "2018"` in NGO block — good
- `email` in NGO block — good
- Physical address in NGO block — good
- Press coverage linked on campaign pages (Guardian, BBC, Channel 4) — strong real-world authority signals
- Campaign pages mention named co-directors (Janey Starling mentioned by name in press items)

### What is missing or weak

**Author attribution on campaign pages — CRITICAL for E-E-A-T**

No campaign page or the homepage carries any author/creator markup. Google's E-E-A-T evaluation for YMYL topics (reproductive rights, domestic violence, criminal justice) heavily weights named human expertise. Every campaign page is unsigned.

**Recommended additions:**

1. Add `Person` schema for key team members who are publicly named (e.g., Janey Starling appears in Guardian, Channel 4, and Sky News citations on the site):

```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Janey Starling",
  "jobTitle": "Co-Director",
  "worksFor": {
    "@type": "NGO",
    "name": "Level Up",
    "url": "https://welevelup.org"
  },
  "url": "https://welevelup.org/about"
}
```

2. Add visible bylines (even "By the Level Up team") on campaign and blog pages.

**No `/about` page in this Astro codebase**

The NGO schema references `https://welevelup.org` as the canonical entity URL but there is no `/about` page in the Astro build. Google uses About pages as a primary E-E-A-T trust signal. Ensure the WordPress-hosted `/about-us` or `/about` page is accessible and links back to the Astro site. Consider adding an `/about` Astro route that provides schema-enriched content about the organisation and its team.

**No `contactPoint` in NGO schema**

Add to the NGO block in Layout.astro:

```json
"contactPoint": {
  "@type": "ContactPoint",
  "email": "hello@welevelup.org",
  "contactType": "general enquiries",
  "availableLanguage": "English"
}
```

---

## 5. Thin Content Pages

### premier-league-and-fa.astro — THIN

**Status: Thin content — HIGH priority**

This page has approximately 80 words of visible body text across three paragraphs, no timeline, no stats section, no press coverage, no blog links. It duplicates content available on the richer `sexual-violence-in-football.astro` page. It appears to be an early stub that was never developed.

**Recommendation:** Either merge this URL into `sexual-violence-in-football.astro` with a 301 redirect, or substantially expand it with the same structure as the other campaign pages (aim, why, timeline, how you can help, press coverage).

### nomorelyes.astro — DUPLICATE / SUPERSEDED

**Status: Duplicate — MEDIUM priority**

This is an older version of the NoMoreLyes campaign page. It contains the same timeline content as `nomorelyes-2.astro` but in a degraded form: it has no `<title>` or `<meta name="description">` (the `<Layout>` is called without those props), a duplicate 2022 timeline entry, and outdated language. It is accessible at `/active-campaigns/nomorelyes` while the authoritative version is at `/active-campaigns/nomorelyes-2`.

**Recommendation:** Add a 301 redirect from `/active-campaigns/nomorelyes` to `/active-campaigns/nomorelyes-2`, or add `noindex` to the old page. The slug `/nomorelyes-2` is also not user-friendly — consider renaming the authoritative page to `/nomorelyes` after redirecting the old one.

### we-protect-us.astro — THIN CONTENT

**Status: Thin — LOW/MEDIUM priority**

The page body contains roughly 100 words of substantive text, a "Next Event" section that says there are no upcoming events, and a video. The content does not reflect the depth of the programme (413 people trained, workshops on police violence). Given training sessions are ongoing, this page would benefit from an expanded "What you'll learn" section, testimonials, and a schedule once dates are confirmed.

---

## 6. Meta Description Quality

| Page | Current meta description | Assessment |
|---|---|---|
| Homepage | "Level Up creates digital tools and campaigns fighting for gender justice in the UK — from reproductive rights to ending violence against women." | PASS — concise, keyword-rich, under 160 chars |
| donate.astro | "Every campaign started with someone like you. Support Level Up's feminist campaigns for gender justice in the UK — from abortion rights to ending violence against women." | WARN — 168 chars, likely truncated. Trim to under 155 chars |
| abortion-is-healthcare | "It's time the law treats abortion as healthcare. Level Up campaigns for full decriminalisation of abortion in England and Wales." | PASS — 128 chars, clear value proposition |
| islington-council | "Holloway Women's Centre is built but standing empty. Tell Islington Council to keep their promise and deliver vital support for women facing trauma, violence, poverty and homelessness." | WARN — 185 chars, will be truncated. Trim to ~150 chars |
| media-guidelines-domestic-abuse | "Level Up's campaign for dignified, accurate media coverage of fatal domestic abuse. Join 29,000+ people demanding IPSO end victim-blaming headlines." | PASS — 149 chars, social proof number is strong |
| pregnancy-in-prison | "Prison will never be a safe place to be pregnant. Level Up campaigns to end the imprisonment of pregnant women and new mothers in England." | PASS — 139 chars, clear |
| sexual-violence-in-football | "Level Up's campaign challenging the culture of impunity around gender-based violence in professional football. Sign the petition to hold the Premier League and FA to account." | WARN — 174 chars, trim |
| nomorelyes-2 | "Level Up's #NoMoreLyes campaign challenges beauty brands to remove toxic chemicals from hair relaxers used by Black women. Read the full campaign timeline." | PASS — 153 chars |
| nomorelyes-open-letter | "Add your name to the open letter calling on L'Oréal to make hair relaxers safe or remove them from shelves. Signed by MPs, campaigners and 5,000+ supporters." | PASS — 159 chars (borderline) |
| premier-league-and-fa | "Level Up campaigns for the Premier League and FA to take a stand against gender-based violence in football. Take action now." | WARN — vague, no specificity on what action or what outcome. Improve with: "Level Up demands the Premier League and FA enforce zero-tolerance policies on gender-based violence. Join 4,300 supporters." |
| we-protect-us | "Join Level Up's free online bystander intervention training. Learn how to safely interrupt harassment in public, at work, or in your community. 413 people trained." | PASS — 163 chars, borderline but strong |
| nomorelyes (old) | MISSING — Layout called with no `title` or `description` props | CRITICAL — page renders with no `<title>` tag |

---

## 7. Heading Keyword Alignment

### Homepage
- `<h1 class="sr-only">Level Up — Feminist Campaigns for Gender Justice in the UK</h1>` — correct use of SR-only H1 since the visual hero is a WordPress clone section
- `<h2>WHO WE ARE</h2>` — decorative, not keyword-targeted; acceptable at section level
- `<h2 class="home-petitions-title">Sign Our Petitions</h2>` — functional, good
- `<h2>How Collective Care Can Change Society</h2>` — matches VideoObject name, good alignment

**Gap:** No heading on the homepage uses the phrase "abortion rights UK", "domestic violence campaigns UK", or "reproductive justice UK" — the phrases people searching for this kind of organisation would use. The "WHO WE ARE" section copy covers these topics but the heading itself is decorative. Consider a descriptive H2 like "Feminist campaigns for reproductive rights, ending domestic violence and gender justice in the UK" for that section.

---

### Campaign pages — heading keyword assessment

| Page | H1 | Alignment with search intent | Gap |
|---|---|---|---|
| abortion-is-healthcare | "Abortion is Healthcare Campaign" | GOOD — matches "abortion decriminalisation UK" searches | Title tag could add "decriminalisation UK" explicitly |
| pregnancy-in-prison | "Pregnancy in Prison" | GOOD — direct match for "pregnant women in prison UK" | |
| media-guidelines-domestic-abuse | "Dignity for Dead Women" | WEAK — campaign brand name, not a search query. People search "domestic abuse media reporting guidelines" | H1 is the campaign name which is defensible; but add an H2 like "Media reporting guidelines for fatal domestic abuse" |
| nomorelyes-2 | "#NoMoreLyes Campaign" | WEAK for SEO — hashtag format not natural search query. People search "hair relaxers cancer risk Black women UK" or "L'Oréal hair relaxer toxic" | Add H2 like "Toxic Chemicals in Hair Relaxers: What Black Women Need to Know" |
| sexual-violence-in-football | "Sexual violence in football" | GOOD — direct match |
| islington-council | "Islington Council: Finish Holloway Women's Centre" | GOOD — brand + location specific |
| premier-league-and-fa | "Premier League and FA" | WEAK — not a campaign name or search phrase. Reads like a page about the organisations, not Level Up's demand | H1 should be "End Gender-Based Violence in Football: Our Demands to the Premier League and FA" |
| we-protect-us | "Free Bystander Intervention Training" | GOOD — matches "bystander intervention training UK free" |
| nomorelyes-open-letter | "Open letter to L'Oréal" | ADEQUATE — specific enough |

---

## 8. Recommended NGO Schema — Improved Version

Replace the current NGO block in `Layout.astro` with this improved version:

```json
{
  "@context": "https://schema.org",
  "@type": "NGO",
  "name": "Level Up",
  "alternateName": "welevelup.org",
  "url": "https://welevelup.org",
  "logo": {
    "@type": "ImageObject",
    "url": "https://welevelup.org/wp-content/uploads/2025/07/level_up_new.webp"
  },
  "description": "Level Up is a UK-based feminist campaigning organisation working to advance reproductive justice, abortion decriminalisation and freedom from systemic violence.",
  "foundingDate": "2018",
  "areaServed": "GB",
  "email": "hello@welevelup.org",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "New Derwent House, 69–73 Theobalds Road",
    "addressLocality": "London",
    "postalCode": "WC1X 8TA",
    "addressCountry": "GB"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "email": "hello@welevelup.org",
    "contactType": "general enquiries",
    "availableLanguage": "en"
  },
  "knowsAbout": [
    "Reproductive rights",
    "Abortion decriminalisation",
    "Domestic abuse",
    "Gender-based violence",
    "Feminist campaigning",
    "Racial justice"
  ],
  "sameAs": [
    "https://www.facebook.com/levelupaction",
    "https://twitter.com/we_level_up",
    "https://www.instagram.com/welevelup"
  ]
}
```

---

## 9. Improved VideoObject — Homepage

Replace the current VideoObject in `index.astro` with this corrected version:

```json
{
  "@context": "https://schema.org",
  "@type": "VideoObject",
  "name": "How Collective Care Can Change Society",
  "description": "Level Up's vision is a world where everyone is loved and liberated. We believe that collective care is the route to building this world. Talk from TEDxLondon, March 2023.",
  "thumbnailUrl": "https://img.youtube.com/vi/xj-alDQD2fg/maxresdefault.jpg",
  "uploadDate": "2023-03-01",
  "contentUrl": "https://www.youtube.com/watch?v=xj-alDQD2fg",
  "embedUrl": "https://www.youtube.com/embed/xj-alDQD2fg",
  "publisher": {
    "@type": "Organization",
    "name": "Level Up",
    "url": "https://welevelup.org"
  }
}
```

Note: Add `"duration": "PTxMxS"` once the exact video length is confirmed. Use ISO 8601 duration format (e.g., `"PT14M32S"` for 14 minutes 32 seconds).

---

## 10. Priority Action List

| Priority | Action | File(s) | Impact |
|---|---|---|---|
| CRITICAL | Add `<title>` and `<meta name="description">` to `nomorelyes.astro` or redirect and remove the page | nomorelyes.astro | Avoids Google indexing a titleless page |
| CRITICAL | Add `contentUrl` to homepage VideoObject | index.astro | Unlocks Google Video rich result eligibility |
| HIGH | Expand or redirect `premier-league-and-fa.astro` — thin content stub | premier-league-and-fa.astro | Eliminates thin content risk |
| HIGH | Replace NGO schema with improved version including `areaServed`, `contactPoint`, `knowsAbout`, `logo` as ImageObject | Layout.astro | Stronger entity definition for Knowledge Panel and AI |
| HIGH | Add BreadcrumbList to all campaign pages | All active-campaigns/*.astro | SERP breadcrumb display |
| HIGH | Trim meta descriptions over 155 chars (donate, islington-council, sexual-violence-in-football) | 3 files | Prevents Google rewriting descriptions |
| MEDIUM | Add WebSite schema with SearchAction to Layout.astro | Layout.astro | Sitelinks searchbox eligibility |
| MEDIUM | Add VideoObject for self-hosted video on we-protect-us | we-protect-us.astro | Video indexing |
| MEDIUM | Add VideoObject for NoMoreLyes parliamentary evidence YouTube embed | nomorelyes-2.astro | Video indexing |
| MEDIUM | Add DonateAction schema to donate.astro | donate.astro | Machine-readable donation intent |
| MEDIUM | Add Event schema to we-protect-us when sessions are scheduled | we-protect-us.astro | Event rich results in SERP |
| MEDIUM | Fix H1 on `premier-league-and-fa.astro` to be descriptive, not just a brand name | premier-league-and-fa.astro | Keyword alignment |
| MEDIUM | Add H2 to media-guidelines page: "Media reporting guidelines for fatal domestic abuse" | media-guidelines-domestic-abuse.astro | Search intent alignment |
| LOW | Add named author attribution (Person schema + visible byline) to campaign pages | All campaign pages | E-E-A-T for YMYL topics |
| LOW | Expand we-protect-us body content; "next events: none" is a dead-end UX and thin content signal | we-protect-us.astro | Content quality |
| INFO | Consider FAQPage markup on abortion-is-healthcare and pregnancy-in-prison for AI/GEO discoverability only — not for Google SERP rich results | 2 campaign pages | AI citation benefit |
| INFO | Add `/about` Astro route with schema-enriched team and mission content | New file | E-E-A-T trust signal |
