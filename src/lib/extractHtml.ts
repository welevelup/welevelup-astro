/**
 * Extracts the renderable parts of a cloned WordPress HTML page.
 *
 * Given a full HTML document, returns the inner content of <head>, the class
 * attribute of <body>, and the inner content of <body>. Also strips WordPress
 * cache-busting query strings (?ver=... and the URL-encoded %3Fver=...) from
 * every asset reference so Astro's static file server can locate them in
 * public/ without the query string becoming part of the filename lookup.
 */
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

export function extract(rawHtml: string): ExtractedHtml {
  const html = rawHtml.replace(VER_QS, '').replace(VER_QS_RAW, '');

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
