/**
 * Walks src/_clone/ at build time and returns every index.html file with its
 * slug (path relative to the clone root, with /index.html stripped).
 *
 * The home slug is the empty string and is excluded by the catch-all route —
 * src/pages/index.astro handles /.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface CloneRoute {
  slug: string;
  file: string;
}

// process.cwd() is the Astro project root in both dev and build.
// import.meta.url would resolve differently once compiled into dist/.
const CLONE_DIR = join(process.cwd(), 'src/_clone');

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (entry === 'index.html') {
      acc.push(full);
    }
  }
  return acc;
}

export function getCloneRoutes(): CloneRoute[] {
  const files = walk(CLONE_DIR);
  const routes: CloneRoute[] = [];
  for (const file of files) {
    const rel = relative(CLONE_DIR, file);
    const slug = rel.replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
    if (slug === '') continue; // home, handled by src/pages/index.astro
    routes.push({ slug, file });
  }
  return routes;
}

let _wpIdMap: Record<string, string> | null = null;

/**
 * Builds a WordPress ID → slug map by reading every cloned page and extracting
 * the postid-NNNN / page-id-NNNN tokens from the body class. This lets us
 * rewrite legacy WP URLs like `index.html?p=1821` (which appear all over the
 * Elementor mega-menu) to the canonical Astro slug like `/about-us`.
 *
 * Memoized: built once per process. The home page resolves to '/'.
 */
export function getWpIdMap(): Record<string, string> {
  if (_wpIdMap !== null) return _wpIdMap;
  const map: Record<string, string> = {};
  const files = walk(CLONE_DIR);
  for (const file of files) {
    let html: string;
    try {
      html = readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const ids = html.match(/(?:postid|page-id)-(\d+)/g) ?? [];
    if (ids.length === 0) continue;
    const rel = relative(CLONE_DIR, file);
    let slug = rel.replace(/\/index\.html$/, '').replace(/^index\.html$/, '');
    const target = slug === '' ? '/' : `/${slug}`;
    for (const idToken of ids) {
      const num = idToken.replace(/^(?:postid|page-id)-/, '');
      // Don't overwrite — first hit wins. Pages tend to be walked before posts.
      if (!(num in map)) {
        map[num] = target;
      }
    }
  }
  _wpIdMap = map;
  return map;
}
