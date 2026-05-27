// Removes the overly broad ^/api(/.*)?$ blocking rule that @vercel/routing-utils
// injects before the specific API routes, which causes /api/contact to 404.
import { readFileSync, writeFileSync } from 'node:fs';

const configPath = '.vercel/output/config.json';
const config = JSON.parse(readFileSync(configPath, 'utf-8'));

const before = config.routes.length;
config.routes = config.routes.filter(
  (r) => !(r.src === '^/api(/.*)?$' && r.status === 404 && !r.dest)
);
const after = config.routes.length;

writeFileSync(configPath, JSON.stringify(config, null, 2));
console.log(`[fix-vercel-routes] Removed ${before - after} blocking /api route(s). Routes: ${before} → ${after}`);
