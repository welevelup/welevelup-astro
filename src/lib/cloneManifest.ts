/**
 * Walks src/_clone/ at build time and returns every index.html file with its
 * slug (path relative to the clone root, with /index.html stripped).
 *
 * The home slug is the empty string and is excluded by the catch-all route —
 * src/pages/index.astro handles /.
 */
import { readdirSync, statSync } from 'node:fs';
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
