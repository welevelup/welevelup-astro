/**
 * Extracts the renderable parts of a cloned WordPress HTML page.
 *
 * Given a full HTML document, returns the inner content of <head>, the class
 * attribute of <body>, and the inner content of <body>. Also:
 *   1. Strips WordPress cache-busting query strings (?ver=... and the
 *      URL-encoded %3Fver=...) from every asset reference so Astro's static
 *      file server can locate the underlying file in public/.
 *   2. Rewrites every internal href= from the wget-mirror form (relative
 *      `about-us.html`, `path/index.html`, `index.html%3Fp=NNNN.html`) to the
 *      canonical Astro route (`/about-us`, `/path`, `/blog/<slug>`). The
 *      WP-id → slug map comes from cloneManifest.getWpIdMap().
 */
import { getWpIdMap } from './cloneManifest';

export interface ExtractedHtml {
  headInner: string;
  bodyClass: string;
  bodyInner: string;
  navHtml: string;
  footerHtml: string;
  preHeaderHtml: string;
  chromeBeforeMain: string;
  chromeAfterMain: string;
  mainContent: string;
}

const VER_QS = /%3Fver=[^"' >]*/g;
const VER_QS_RAW = /\?ver=[^"' >]*/g;
const HEAD_RE = /<head[^>]*>([\s\S]*?)<\/head>/i;
const BODY_RE = /<body([^>]*)>([\s\S]*)<\/body>/i;
const CLASS_RE = /class="([^"]*)"/;
const HREF_RE = /href="([^"]+)"/g;

const SKIP_SCHEME = /^(mailto:|tel:|#|data:|javascript:|\?)/;
const WELEVELUP_ABS = /^https?:\/\/(www\.)?welevelup\.org\//;
const ASSET_PATH = /wp-content|wp-includes|wp-json/;
const ASSET_EXT = /\.(css|js|xml|json|webp|jpe?g|png|svg|gif|ico|pdf|zip|woff2?|ttf|eot)(\?|$)/i;

const WP_ID_RE = /^(?:.*\/)?index\.html%3F(?:p|page_id)=(\d+)\.html$/i;

/**
 * Rewrites a wget-mirror relative link into the corresponding Astro route.
 * Examples:
 *   about-us.html                       → /about-us
 *   about-us/index.html                 → /about-us
 *   active-campaigns/foo/index.html     → /active-campaigns/foo
 *   index.html                          → /
 *   index.html%3Fp=1821.html            → /about-us (via WP id map)
 *   ../donate/index.html                → /donate
 */
function rewriteLink(url: string): string {
  if (SKIP_SCHEME.test(url)) return url;

  // Rewrite absolute welevelup.org URLs to relative paths
  // e.g. https://welevelup.org/our-team/ → /our-team
  if (WELEVELUP_ABS.test(url)) {
    const path = url.replace(WELEVELUP_ABS, '/');
    // Skip external-looking assets
    if (ASSET_PATH.test(path)) return url;
    if (ASSET_EXT.test(path)) return url;
    // Clean trailing slash and .html
    let clean = path.replace(/\/index\.html$/, '').replace(/\.html$/, '');
    if (clean.length > 1) clean = clean.replace(/\/+$/, '');
    if (clean === '') clean = '/';
    return clean;
  }

  // Skip non-welevelup external URLs
  if (/^https?:\/\//.test(url)) return url;

  if (ASSET_PATH.test(url)) return url;
  if (ASSET_EXT.test(url)) return url;

  // WordPress legacy URL by post/page id → look up real slug.
  const wpIdMatch = url.match(WP_ID_RE);
  if (wpIdMatch) {
    const id = wpIdMatch[1];
    const mapped = getWpIdMap()[id];
    if (mapped) return mapped;
    // Unknown id → fall through to home so the link is at least valid.
    return '/';
  }

  // Strip ../ and ./ leading components
  let path = url.replace(/^(\.\.?\/)+/, '');

  // Ensure leading slash
  if (!path.startsWith('/')) path = '/' + path;

  // /something/index.html → /something
  path = path.replace(/\/index\.html$/, '');
  // top-level /something.html → /something
  path = path.replace(/\.html$/, '');
  // collapse trailing slash (per trailingSlash: 'never')
  if (path.length > 1) path = path.replace(/\/+$/, '');
  if (path === '') path = '/';

  return path;
}

function stripDuplicateHeadTags(raw: string): string {
  return raw
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\b[^>]*\bname="description"[^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bproperty="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\b[^>]*\bname="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/<link\b[^>]*\brel="canonical"[^>]*>/gi, '')
    // DO NOT strip charset or viewport — these are essential HTML metadata
    // Strip heavy WP scripts that bloat every page (GTM, GA, GiveWP, pixel duplicates)
    .replace(/<script\b[^>]*googletagmanager[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*googletagmanager[^>]*\/?>/gi, '')
    .replace(/<script\b[^>]*gtag[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*give\.js[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*give\.js[^>]*\/?>/gi, '')
    .replace(/<script\b[^>]*fbevents[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<script\b[^>]*fbevents[^>]*\/?>/gi, '')
    .replace(/<script\b[^>]*pixelyoursite[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<noscript\b[^>]*>[\s\S]*?googletagmanager[\s\S]*?<\/noscript>/gi, '');
}

function stripSvgPlaceholders(html: string): string {
  // Remove WordPress SVG placeholder bloat that kills LCP/CLS (495+ instances)
  // If there's a data-src (real image), promote it; otherwise strip the img tag entirely
  return html.replace(/<img[^>]*src="data:image\/svg[^"]*"[^>]*>/gi, (match) => {
    const dataSrcMatch = match.match(/data-src="([^"]*)"/);
    if (dataSrcMatch && dataSrcMatch[1]) {
      // Extract alt text if present, fallback to empty string
      const altMatch = match.match(/alt="([^"]*)"/);
      const alt = altMatch ? altMatch[1] : '';
      // Promote data-src to src and add alt text
      return `<img src="${dataSrcMatch[1]}" alt="${alt}" loading="lazy" />`;
    }
    // No real image URL found, remove completely
    return '';
  });
}

export function extract(rawHtml: string): ExtractedHtml {
  const html = rawHtml
    .replace(VER_QS, '')
    .replace(VER_QS_RAW, '')
    .replace(HREF_RE, (_, url) => `href="${rewriteLink(url)}"`);

  const headMatch = html.match(HEAD_RE);
  const headInner = headMatch ? stripDuplicateHeadTags(headMatch[1]) : '';

  const bodyMatch = html.match(BODY_RE);
  if (!bodyMatch) {
    return { headInner, bodyClass: '', bodyInner: '', navHtml: '', footerHtml: '', preHeaderHtml: '' };
  }

  const bodyAttrs = bodyMatch[1];
  const bodyInner = bodyMatch[2];
  const classMatch = bodyAttrs.match(CLASS_RE);
  const bodyClass = classMatch ? classMatch[1] : '';

  // Extract nav (Elementor header) and footer separately
  const navMatch = bodyInner.match(/<header[^>]*data-elementor-type="header"[\s\S]*?<\/header>/i);
  const navHtml = navMatch ? navMatch[0] : '';

  const footerMatch = bodyInner.match(/<footer[^>]*data-elementor-type="footer"[\s\S]*?<\/footer>/i);
  const footerHtml = footerMatch ? footerMatch[0] : '';

  // Pre-header content (GTM noscript, skip-link)
  const preHeaderMatch = bodyInner.match(/^([\s\S]*?)(?=<header)/i);
  const preHeaderHtml = preHeaderMatch ? preHeaderMatch[1] : '';

  // Chrome splits: everything before main content, everything after
  // chromeBeforeMain = preHeader + header (up to </header>)
  const headerEndIdx = bodyInner.indexOf('</header>');
  const chromeBeforeMain = headerEndIdx >= 0
    ? bodyInner.slice(0, headerEndIdx + '</header>'.length)
    : preHeaderHtml + navHtml;

  // chromeAfterMain = footer + everything after (scripts, etc.)
  const footerStartIdx = bodyInner.indexOf('<footer');
  const chromeAfterMain = footerStartIdx >= 0
    ? bodyInner.slice(footerStartIdx)
    : footerHtml;

  // mainContent = everything between </header> and <footer (the actual page content)
  const mainContent = (headerEndIdx >= 0 && footerStartIdx >= 0)
    ? stripSvgPlaceholders(bodyInner.slice(headerEndIdx + '</header>'.length, footerStartIdx))
    : stripSvgPlaceholders(bodyInner);

  return { headInner, bodyClass, bodyInner, navHtml, footerHtml, preHeaderHtml, chromeBeforeMain, chromeAfterMain, mainContent };
}
