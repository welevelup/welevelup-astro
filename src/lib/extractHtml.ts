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
}

const VER_QS = /%3Fver=[^"' >]*/g;
const VER_QS_RAW = /\?ver=[^"' >]*/g;
const HEAD_RE = /<head[^>]*>([\s\S]*?)<\/head>/i;
const BODY_RE = /<body([^>]*)>([\s\S]*)<\/body>/i;
const CLASS_RE = /class="([^"]*)"/;
const HREF_RE = /href="([^"]+)"/g;

const SKIP_SCHEME = /^(https?:|mailto:|tel:|#|data:|javascript:|\?)/;
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

export function extract(rawHtml: string): ExtractedHtml {
  const html = rawHtml
    .replace(VER_QS, '')
    .replace(VER_QS_RAW, '')
    .replace(HREF_RE, (_, url) => `href="${rewriteLink(url)}"`);

  const headMatch = html.match(HEAD_RE);
  const headInner = headMatch ? headMatch[1] : '';

  const bodyMatch = html.match(BODY_RE);
  if (!bodyMatch) {
    return { headInner, bodyClass: '', bodyInner: '' };
  }

  const bodyAttrs = bodyMatch[1];
  const bodyInner = bodyMatch[2];
  const classMatch = bodyAttrs.match(CLASS_RE);
  const bodyClass = classMatch ? classMatch[1] : '';

  return { headInner, bodyClass, bodyInner };
}
