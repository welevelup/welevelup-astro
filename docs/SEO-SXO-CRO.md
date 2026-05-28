# Level Up — SXO, SEO & CRO Analysis
**welevelup.org | UK Feminist Campaigns NGO**
**Analysis date: April 2026**
**Goal: Increase petition signatures and donations**

---

## SXO Gap Score: 61 / 100

This score reflects how well the site satisfies visitor intent as expressed in search behaviour — separate from technical SEO health.

---

## PRIMARY FINDING: Dual-Intent Mismatch on the Homepage

**Severity: HIGH**

The homepage serves two visitor types with conflicting needs:

- **Discovery visitors** (arriving from search: "UK feminist NGO", "gender justice campaigns UK") need to understand who Level Up is and why they should care before acting.
- **Ready-to-act visitors** (arriving via social share, email, or direct link) want to sign or donate immediately with minimal friction.

The current page structure forces both groups through the same linear journey in the wrong order for each. Discovery visitors hit a WP-cloned hero before any clear mission statement. Ready-to-act visitors must scroll past "Who We Are" and a TED talk section before reaching petition cards.

**SERP context:** Searches for "Level Up feminist UK" and adjacent terms surface Level Up's own pages alongside Fawcett Society, ActionAid, and Change.org petition pages. Google rewards pages that resolve intent within the first visible block. The homepage currently resolves neither intent cleanly in the first scroll position.

---

## 1. Value Proposition Clarity — Does the mission land in 5 seconds?

**Rating: PARTIAL**

What works:
- The `<h1>` ("Level Up — Feminist Campaigns for Gender Justice in the UK") is correct and keyword-rich, though it is `sr-only` (screen-reader only) — it does not render visibly. This is a meaningful gap: the most semantically authoritative statement on the page is invisible to sighted users.
- The "Who We Are" section copy is strong and specific ("flying a plane banner over a football match", "UK's first media guidelines on reporting domestic abuse deaths"). Concrete achievements build credibility faster than abstract mission statements.
- The meta title and description are well-formed for search.

What fails:
- Above the fold, sighted users see a WP-cloned Elementor hero section whose content is not controlled in the Astro source. Its message is unknown and unpredictable — it could be anything currently rendering in `mainContent`.
- The animated announcement bar (`ic-bar`) appears after the hero. On mobile it is repositioned below the hero via JS, but only if `[data-id="bc8074a"]` or `.e-con.e-parent` are found — a fragile selector dependency. If those elements change, the mobile positioning silently breaks.
- The "Who We Are" section does not contain a CTA. Someone convinced by Level Up's mission at that moment has no immediate next action.

**Fix priority: HIGH** — Make the H1 visible. Add a single CTA line to the Who We Are section ("Sign a petition. Donate. Join us.").

---

## 2. CTA Hierarchy — Petition and Donate Button Prominence

**Rating: MODERATE**

What works:
- The nav "Donate" button (lime green, `#CCFF33` on `#0C0A3E`) and "Join Us" button (dark on white) are persistent at the top of every page — good.
- The petition cards have a clear "Sign" button styled in dark navy with lime text. The visual contrast is strong.
- The featured Islington campaign banner has a clear primary CTA ("Sign the petition") with appropriate visual hierarchy.

What fails:
- **No donate CTA anywhere on the homepage body.** The bottom CTA section (`home-cta`) links only to "Join us" (yourmovement.org email signup), not to `/donate`. A visitor who scrolls the entire homepage has no nudge to donate until they return to the sticky nav.
- **"Sign →" is an arrow-text link.** For low-engagement visitors this reads as a secondary action. "Sign the petition" as full label performs better in NGO A/B tests because it states the action and the object.
- The sixth petition card (Holloway Women's Centre) is missing the `home-petition-supporters` count element — the only card without social proof. This makes it look less legitimate than the others despite being the featured campaign.
- **Sign buttons open `target="_blank"`** — this breaks browser back-button flow and can feel like a trap on mobile. Petition platforms should generally open in the same tab for first-time signers, or at minimum warn with visible external-link indication.

**Fix priority: HIGH** — Add a donate CTA to the bottom `home-cta` section alongside "Join us". Expand "Sign →" to "Sign the petition →".

---

## 3. Social Proof — Supporter Counts Visibility

**Rating: GOOD with gaps**

What works:
- Five of six petition cards display supporter counts: 6.1K, 13.1K, 6.4K, 29.2K, 4.3K. The 29.2K "Dignity for Dead Women" figure is genuinely compelling and placed on the fourth card.
- Counts are styled with a high-contrast dark pill badge — visually distinctive.

What fails:
- The **Holloway Women's Centre card has no supporter count** at all. This is the featured campaign (top of the announcement bar, dedicated banner section). The one campaign with the most prominent placement has the weakest social proof signal.
- Counts use a comma as decimal separator (`6,1K`, `13,1K`) rather than a period or no separator (`6.1K`, `6,100`). UK convention is `6,100` or `6.1K` (with period). This reads as an error to a British audience and subtly undermines credibility.
- There is **no aggregate community size claim** on the page. "Join 60,000+ supporters" or equivalent would anchor visitors who have not seen individual petition counts yet.
- The donation page has **zero social proof**. The impact stats (4 bullet points) are achievement statements — valuable — but there are no donor counts, no testimonials, no "X people donated this month" signals. This is a significant conversion suppressor on the most high-stakes page.

**Fix priority: HIGH** — Fix the Holloway card count, fix the decimal formatting, add a total community size claim to the homepage hero area, add at least one donor social proof element to the donate page.

---

## 4. Navigation — Findability of Petitions and Donate

**Rating: GOOD**

What works:
- Two-row nav with persistent "Donate" (lime) and "Join Us" (dark) in the top row is the right call — these are high-value actions that deserve always-visible placement.
- Campaigns mega-dropdown is well-structured. Each campaign column leads with the campaign name and surfaces "Sign the petition" as the first sub-link — correct priority.
- Mobile nav includes dedicated `lu-nav-mobile-join` and `lu-nav-mobile-donate` buttons that appear inside the expanded drawer. These are correctly styled and distinguishable.

What fails:
- **Desktop: "Donate" disappears on mobile** (`display: none !important` at `max-width: 900px`). The mobile header only shows the logo and hamburger. The sticky lime "Donate" button — the single most important conversion entry point — is invisible until the user opens the drawer. This is a significant mobile CRO problem.
- **"Join Us" also hidden on mobile header** — same issue. The user must open the menu to find both primary actions.
- Mega-dropdown is hover-only on desktop. Touch/keyboard users cannot access it. There is a JS fallback for mobile (click to toggle), but desktop keyboard users cannot navigate into Campaign sub-pages without a mouse.
- The "Community" dropdown includes the Islington Council campaign alongside "Space for Memory" (abortion stories, solidarity messages, hair stories). These are categorically different things. A new visitor has no frame of reference for "Community" as a nav label — it suggests a forum or member area, not local campaigns.

**Fix priority: CRITICAL for mobile donate visibility** — Show a compact "Donate" button in the mobile header row (between logo and hamburger). This is the highest-ROI single change on the site.

---

## 5. Friction Points — What Stops Someone From Signing or Donating

**Signing friction:**

1. Petition sign buttons open in `target="_blank"` with no visual indicator. Users lose their place on the homepage and may not return.
2. Petition descriptions are very short (1 sentence). A visitor who does not already know about the campaign has insufficient context to feel motivated to sign without clicking "Learn more" first — adding a step to the journey.
3. The Holloway card has no supporter count, which reduces perceived momentum and urgency.
4. No urgency signal on petition cards (no deadlines, no "X signed today", no "almost at target" indicators).

**Donation friction:**

1. **No charity registration number** on the donate page or footer. UK donors specifically look for this before giving. Its absence is a significant trust failure. The Fawcett Society, ActionAid and every comparable UK NGO display their charity number prominently on their donate page.
2. **No Gift Aid prompt.** Gift Aid is worth 25% uplift on every donation from a UK taxpayer. Not prompting for it is leaving money on the table and also signals to donors that the org may not be set up professionally for UK giving.
3. The form collects Full Name and Email but **name is not marked as required**. The submit handler only validates email. If name is genuinely optional, remove the field — every unnecessary field reduces completion rates. If it is needed, mark it required.
4. The submit CTA "Continue to secure payment →" is good (specific, directional) but the word "Continue" implies more steps than necessary. "Donate £10 securely →" (dynamic, showing selected amount) would reduce uncertainty about what happens next.
5. The donate page **lacks a cancel-anytime reassurance above the form** for monthly giving. The legal note at the bottom says cancellation is via email — this reads as friction ("I have to email to cancel?"). A note like "Cancel anytime, instantly" before the form submit removes the mental barrier.
6. **Thank-you page is bare.** After donating, users land on a plain text page with no emotion, no campaign reinforcement, no share CTA, no petition prompt. This is a missed opportunity for the second conversion (sharing) and for deepening supporter identity.

**Fix priority: CRITICAL** — Add charity registration number to donate page and footer. Add Gift Aid tickbox. The rest are HIGH priority.

---

## 6. Page-Type Intent Match

**Rating: MODERATE**

For organic search traffic, the homepage must serve as both a brand-awareness landing page ("who is Level Up?") and a campaign-action hub ("I want to sign something").

The current structure is:
1. Elementor hero (brand/awareness — uncontrolled)
2. Announcement bar (campaign action)
3. Who We Are (awareness)
4. TED talk video (awareness/depth)
5. Featured campaign banner (action)
6. Petition grid (action)
7. Blog (awareness/depth)
8. Join CTA (email signup)

The section order reflects a deliberate "earn trust then ask" structure — which is correct for cold discovery traffic. However:

- The "action" path is too long. A visitor who already knows Level Up and wants to sign must scroll past three awareness sections.
- There is no visual "skip to petitions" affordance for returning visitors.
- The TED talk section is a significant scroll-depth commitment between awareness and action. On mobile, where each section is set to `min-height: 100vh`, the user must swipe through four full screens before reaching any petition.

**Recommendation:** Add a short in-page "quick jump" row directly below the hero — three link pills: "Sign a petition", "Donate", "Join the community" — to serve both visitor types without restructuring the entire page.

---

## 7. Mobile Experience Concerns

**Rating: NEEDS WORK**

- **`min-height: 100vh` on every major section** (Who We Are, Video, Banner, Petitions, Blog) means a mobile user sees one section per screen and must perform 5+ deliberate swipes to reach petitions. This is appropriate for scrollytelling experiences with strong visual payoff at each screen, but Level Up's sections are text-heavy — the full-screen height creates excess whitespace rather than drama. Consider `min-height: 70vh` for text sections.
- **Donate and Join Us hidden from mobile header** — covered in section 4. This is the most urgent mobile CRO issue.
- **Announcement bar on mobile** repositions via JS with fragile selectors. A CSS-only approach (`order` in flexbox, or page structure) would be more robust.
- **Petition grid at 480px collapses to single column** — correct. However petition card images remain at `object-fit: cover` with fixed heights, and the "Sign →" button could be confused with the card-level link overlay that the `::after` pseudo-element creates on `.home-petition-learn`. The z-index stacking (sign at `z-index: 1`, learn at `z-index: 0` with `inset: 0` pseudo) needs testing to confirm the sign button is always tappable.
- **No preload or fetchpriority="high"** on the hero image (which is served from Elementor/WP and not controlled in source). LCP will be high if the cloned hero contains a large above-the-fold image without prioritisation hints.
- **YouTube iframe is `loading="lazy"`** — correct. However, the TED talk section is `min-height: 100vh` on mobile, making it a full-screen section that users scroll to. The lazy load boundary may fire late causing a visible load delay when the user reaches it.

---

## 8. Trust Signals — What Is Missing

**Present:**
- Physical address in footer (London, WC1X 8TA) — good
- Email address (hello@welevelup.org) — good
- Social media links (Facebook, Twitter/X, Instagram)
- Creative Commons licence notice
- VideoObject schema on the TED talk
- Mollie payment processor named on donate page ("Payments are processed securely by Mollie")
- Press coverage page exists (linked in nav)

**Missing:**
- **Charity registration number** — critical for UK donor trust. Companies House or Charity Commission number should appear on the donate page, footer, and about page.
- **Registered charity status statement** ("Level Up is a registered charity in England and Wales, no. XXXXXX") — standard requirement for UK fundraising.
- **Gift Aid declaration** — absence signals non-standard UK charity setup to informed donors.
- **Funder logos or grant acknowledgements** — peer organisations (Fawcett Society, ActionAid) display trust-building funder logos. Level Up's funding model is not visible.
- **Named leadership / team page** — the "Who We Are" nav item goes to a page but the homepage "Who We Are" section is entirely anonymous. Named, credible people build trust. The TED talk implies a speaker — credit them visibly.
- **Media logos ("As seen in")** — Level Up has genuine press coverage (a dedicated press page exists) but no "As seen in: BBC, Guardian, ITV..." strip on the homepage. This is social proof that converts sceptical new visitors.
- **Secure payment badge** — the Mollie mention is text-only. A Mollie logo or lock icon next to the submit button reduces payment anxiety.
- **SSL/security signal** is implicit (HTTPS) but no visual reinforcement near the donation form submit button.
- **Testimonials from supporters** — zero on any page reviewed. A single quote from a campaign beneficiary or long-term donor would meaningfully increase emotional resonance on both homepage and donate page.

---

## Gap Analysis — SXO Dimensions (100 pts)

| Dimension | Score | Max | Notes |
|---|---|---|---|
| Page Type / Intent Match | 9 | 15 | Serves mixed intent but no quick-jump for action visitors |
| Content Depth | 11 | 15 | Strong campaign copy; blog section adds depth; TED talk schema in place |
| UX Signals | 8 | 15 | Mobile donate hidden; no urgency signals; external petition links lose users |
| Schema | 9 | 15 | VideoObject present; Organisation schema not found; no BreadcrumbList or FAQPage |
| Media | 10 | 15 | Campaign images present with good alt text; TED video embedded; no "As seen in" press logos |
| Authority | 8 | 15 | No charity number; no named team; no funder logos; press page exists but not surfaced |
| Freshness | 6 | 10 | Announcement bar signals recent activity; blog articles dated; campaign "847 signed this week" is manually hardcoded and will go stale |

**Total: 61 / 100**

---

## User Stories Derived from SERP Signals

**Signal source:** SERP for "Level Up feminist UK" surfaces welevelup.org homepage, specific campaign pages, Holloway Women's Centre campaign, and Twitter/X profile. PAA-equivalent searches cluster around "what does Level Up campaign for" and "how to support feminist organisations UK".

1. **Awareness stage — Discovery visitor**
   As someone who has seen Level Up mentioned on social media, I want to understand what they actually campaign for and whether their approach aligns with my values, so that I can decide whether to get involved.
   *Signal: Homepage ranks for branded search; "Who we are" and "How we choose our campaigns" pages indexed.*

2. **Consideration stage — Issue-motivated visitor**
   As someone who cares about the Holloway Women's Centre campaign specifically, I want to find the petition quickly, understand the context, and sign without leaving the site, so that I can take action in under 2 minutes.
   *Signal: Holloway campaign page indexed separately; announcement bar surfacing this campaign specifically.*

3. **Decision stage — Ready to donate visitor**
   As someone who already follows Level Up and wants to give financially, I need to see that they are a legitimate UK charity, know my money is protected, and be able to set up a monthly donation without confusion, so that I feel confident completing the payment.
   *Signal: "donate feminist charity UK" search cluster; Mollie integration; absence of Gift Aid currently creates distrust.*

4. **Consideration stage — Cause researcher**
   As a journalist, grant-maker or academic researching UK feminist organising, I want to find concrete evidence of Level Up's impact, organisational credibility and funding model, so that I can cite or recommend them.
   *Signal: Press page indexed; "What we are proud of" page indexed; blog content ranking for specific campaign terms.*

5. **Awareness stage — Intersectional issue visitor**
   As a Black woman who has heard about the #NoMoreLyes hair relaxer campaign, I want to find the petition and share it with my community, so that I can amplify an issue that directly affects me and people I know.
   *Signal: #NoMoreLyes campaign page indexed; specific search traffic for hair relaxer harm UK.*

---

## Persona Scoring

Personas are scored on Relevance (R), Clarity (C), Trust (T), Action (A) — 25 pts each.

### Persona 1: The Sceptical First-Timer (Score: 56 / 100)
Someone who clicked a shared link, does not know Level Up, and is deciding in 30 seconds whether to care.
- R: 18/25 — Content is relevant but mission statement is not visible above fold
- C: 14/25 — "Who We Are" copy is buried below the hero; sr-only H1 invisible to them
- T: 10/25 — No charity number, no named team, no funder logos, no press logos
- A: 14/25 — No CTA in or near the Who We Are section; donate button hidden on mobile
**Recommendation:** Surface a visible H1 + 2-sentence mission statement in the hero. Add "As seen in" press logo strip immediately below it. Add charity number to footer.

### Persona 2: The Campaign Signer (Score: 68 / 100)
Someone who wants to sign a specific petition and is looking for it quickly.
- R: 22/25 — Petitions are present and well-organised
- C: 18/25 — Petition cards are clear but descriptions are very thin
- T: 16/25 — Supporter counts present on 5/6 cards; Holloway card missing
- A: 12/25 — External target="_blank" breaks flow; no urgency signals; "Sign →" undersells the action
**Recommendation:** Fix Holloway supporter count. Add "X signed today" or target indicator to at least the featured campaign. Change "Sign →" to "Sign the petition →". Remove target="_blank" from petition links or add return-path context.

### Persona 3: The Ready Donor (Score: 52 / 100)
Someone who has decided to give money and is on the donate page.
- R: 20/25 — Page is clearly a donation page with reasonable framing
- C: 16/25 — Form is clean and well-labelled; but no clarity on what their £10/month funds specifically
- T: 8/25 — No charity number; no Gift Aid; no named payment processor logo; cancel process unclear
- A: 8/25 — CTA says "Continue" not the action; no "Donate £10 monthly" dynamic label; no share prompt after donation
**Recommendation:** Add charity registration number above the form. Add Gift Aid tickbox. Change button label to dynamic "Donate £[amount] [monthly/once] →". Add a donor testimonial or impact statement ("Your £10/month helps us run bystander training for 400+ people a year").

### Persona 4: The Issue-Aware Advocate (Score: 74 / 100)
Someone who follows feminist issues in the UK and wants to share Level Up's work.
- R: 23/25 — Blog section and campaign pages are highly relevant
- C: 20/25 — Blog cards are clear with topic tags
- T: 20/25 — Content credibility is high; citations and real achievements mentioned
- A: 11/25 — No social share buttons on homepage; no "share this campaign" CTA on petition cards; blog cards lead away from conversion funnel
**Recommendation:** Add social share buttons to petition cards ("Share this petition"). Add a "share" micro-CTA to the featured campaign banner alongside "Sign the petition".

### Persona 5: The Mobile-Only Visitor (Score: 48 / 100)
Someone browsing on a phone, likely referred from Instagram or Twitter.
- R: 20/25 — Content is relevant
- C: 14/25 — 100vh sections create long scroll; mission not visible above fold on mobile
- T: 10/25 — Same trust gaps as Persona 1, amplified on smaller screen
- A: 4/25 — Donate and Join Us hidden from mobile header until drawer opened; 4+ full-screen swipes before petition cards
**Recommendation:** Show compact "Donate" button in mobile header at all times. Reduce section min-height to 60-70vh for text-only sections. Move petition grid higher on mobile (CSS `order` property).

---

## Quick Wins (implement this week, no design system change required)

1. **Make the H1 visible.** Remove `class="sr-only"` from the H1 in `index.astro`. Style it to be visually prominent in the hero area. This is a one-line change with immediate SEO and clarity benefit.

2. **Fix the Holloway petition card supporter count.** The sixth card in the petitions grid is missing the `home-petition-supporters` span. Add a count. Even a conservative "800+ supporters" is better than nothing for the featured campaign.

3. **Fix supporter count formatting.** Change `6,1K` → `6.1K` (period, not comma) across all five petition cards. UK convention reads comma-as-thousands-separator and the current format appears as a typo.

4. **Add charity registration number to footer and donate page.** If Level Up is a registered charity, add "Registered charity no. XXXXXX" to the footer legal block and as a one-liner above the donate form submit button. If Level Up is not a registered charity, add "Company registered in England and Wales" with the company number. This is a legal best practice in UK fundraising.

5. **Add Gift Aid tickbox to donate form.** A single checkbox: "I am a UK taxpayer and want Level Up to claim Gift Aid on this donation (+25%)". This increases effective donation value and signals professional UK charity infrastructure.

6. **Change bottom CTA section from "Join us" only to "Join us + Donate".** In `index.astro`, the `.home-cta` section links only to email signup. Add a second button: `<a href="/donate" class="home-cta-btn-secondary">Make a donation →</a>`. A visitor who has scrolled to the bottom of the homepage is warm — do not offer only email signup.

7. **Expand "Sign →" to "Sign the petition →"** on petition cards. Change `home-petition-sign` link text from `Sign →` to `Sign petition →` or `Sign the petition`. Costs nothing, clarifies the action for hesitant visitors.

---

## High-Impact Changes (2–4 weeks, require design decision)

1. **Show Donate button in mobile header at all times.**
   In `Nav.astro`, the `.lu-nav-donate` has `display: none !important` at `max-width: 900px`. Change this to show a compact version (icon + "Donate", or just "Donate" in a smaller pill). This is the highest-ROI mobile change on the site. The mobile header currently has room — the logo and hamburger leave space.

2. **Add a quick-jump action row to the homepage hero area.**
   Directly below the Elementor hero and above the announcement bar, add three pill links:
   - "Sign a petition" → scrolls to `#petitions`
   - "Donate" → `/donate`
   - "Join us" → yourmovement.org
   This serves both ready-to-act and discovery visitors without restructuring the page.

3. **Add "As seen in" press logo strip to homepage.**
   Level Up has a press page. Extract 4–6 recognisable logos (BBC, The Guardian, ITV, Vice, etc.) and add a one-row strip immediately after the Who We Are section. This converts the sceptical first-timer (Persona 1) faster than any copy change.

4. **Add urgency / momentum signals to petition cards.**
   At minimum for the featured Holloway campaign: "847 signed this week" (already in the announcement bar — surface it on the card too). For other campaigns, add a progress indicator or "X signed this month" sub-label below the supporter count badge.

5. **Add one donor quote to the donate page.**
   Between the impact stats section and the form, add a single blockquote from a real supporter. "I give £10 a month because Level Up campaigns on issues no one else touches. — Sarah, Manchester." This alone can lift donation conversion rates by 10–20% in NGO context.

6. **Overhaul the thank-you page.**
   `donate/thank-you.astro` is a bare three-paragraph text page. At minimum add:
   - Campaign image or logo
   - "Share your donation on Twitter" link (pre-filled tweet)
   - Link to sign a petition ("While you're here, also sign...")
   - Social follow prompt
   The thank-you page is the highest-intent moment in the donor relationship — do not waste it.

7. **Remove `target="_blank"` from petition sign links, or add explicit guidance.**
   External petition links silently open new tabs. Users who complete a petition externally and close the tab lose their place on the Level Up homepage. Either open in the same tab (preferred for conversions) or add a visual cue ("Opens yourmovement.org") so users know to return.

8. **Reduce `min-height: 100vh` on text-heavy mobile sections.**
   The Who We Are and Blog sections render as full-screen sections on mobile despite being text, not visual. Set `min-height: 60vh` or remove the full-screen constraint for these sections. The Video and Campaign Banner sections can retain `min-height: 80vh` as they have visual payoff.

---

## Test Ideas (A/B or multivariate, 4–8 weeks)

1. **Test: Visible H1 mission statement vs current sr-only H1.**
   Hypothesis: Displaying "Level Up — Feminist Campaigns for Gender Justice in the UK" visibly in the hero increases time on page and petition card click-through for cold traffic.
   Primary metric: Petition card CTR from homepage.

2. **Test: "Donate £10 monthly →" dynamic button label vs "Continue to secure payment →".**
   Hypothesis: Reflecting the selected amount in the CTA label increases form completion rate by reducing uncertainty about what happens next.
   Primary metric: Donate form submission rate.

3. **Test: Petition card "Sign the petition →" vs "Sign →".**
   Hypothesis: Full-label CTA increases click-through from users who are scanning rather than reading.
   Primary metric: Click-through rate per petition card.

4. **Test: Donate page with Gift Aid tickbox vs without.**
   Hypothesis: Adding Gift Aid increases both conversion rate (signals legitimacy) and effective revenue per donor (25% uplift on eligible donations).
   Primary metric: Form completion rate and effective GBP per donation.

5. **Test: Homepage with "As seen in" press strip vs without.**
   Hypothesis: Showing 4 press logos above the petition section reduces bounce rate for cold discovery traffic and increases petition card interaction.
   Primary metric: Bounce rate for organic search sessions and scroll-depth to petitions.

6. **Test: Quick-jump action row below hero vs no quick-jump row.**
   Hypothesis: Petition card CTR improves for returning visitors and social-referred visitors who already know Level Up and want to act without scrolling through awareness content.
   Primary metric: Time-to-first-petition-click and petition card CTR segmented by new vs returning visitors.

7. **Test: Thank-you page with "Share your donation" CTA vs bare current page.**
   Hypothesis: A share prompt on the thank-you page generates measurable secondary traffic and increases the social identity connection of new donors, improving 90-day retention.
   Primary metric: Social share clicks; email open rate at 30 days for donors who shared vs did not.

---

## Cross-Skill Recommendations

- **Schema gaps detected:** `Organisation` schema is absent from the homepage. `BreadcrumbList` is absent from campaign pages. `FAQPage` could be added to the donate page for common questions (Gift Aid, cancellation, card security). Recommend running `/seo schema` generation for these types.
- **Thin campaign descriptions on homepage petition cards:** The one-sentence descriptions (e.g. "It's time the law treats it as such. Join the campaign.") give Google and visitors very little to evaluate intent from. Recommend `/seo content` deep analysis on campaign pages to ensure they capture long-tail petition-related queries.
- **E-E-A-T gaps:** No named authors on blog posts visible in source. No editorial credentials or named team on any page reviewed. Author schema and a visible team/about page are important for YMYL (Your Money or Your Life) and YMAL (Your Movement, Advocacy, Legislation) content. Recommend `/seo content` for author entity markup.

---

## Limitations

- Live server fetch was blocked by sandbox permissions. Analysis is based entirely on Astro source files. Rendered output of the Elementor-cloned `mainContent` (the WP hero) could not be inspected — its above-the-fold content, images, and any text overlapping with the new components is unknown.
- Actual supporter counts on the petition platform (yourmovement.org) were not verified against what is hardcoded in the source. "847 signed this week" in the announcement bar is a hardcoded string and may not reflect live data.
- Page speed, Core Web Vitals, and crawl coverage were not assessed (no Lighthouse or Search Console access).
- Charity registration status and number were not confirmed — the recommendation to add them assumes Level Up has registration. If the organisation's legal structure differs (e.g. CIC, limited company), the specific language would differ.
- SERP analysis was based on web search results for adjacent queries, not a full 10-result SERP scrape for exact target keywords.

---

*Generate a PDF report? Use `/seo google report`*

*Sources consulted: [welevelup.org](https://welevelup.org/) — [Level Up campaigns](https://welevelup.org/what-we-are-proud-of/) — [Fawcett Society](https://www.fawcettsociety.org.uk/) — [ActionAid UK](https://www.actionaid.org.uk/) — [Womankind Worldwide](https://www.womankind.org.uk/) — [Global Fund for Women](https://www.globalfundforwomen.org/get-involved/give-now/) — [Gender and Development Network](https://gadnetwork.org/)*
