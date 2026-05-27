/**
 * One-shot backup script — exports every Mollie customer, subscription, and
 * recent payment to a timestamped JSON file in scripts/backups/.
 *
 * Usage:
 *   MOLLIE_API_KEY=live_xxx npx tsx scripts/backup-mollie-data.ts
 *
 * Or set MOLLIE_API_KEY in .env.local and just run:
 *   npx tsx scripts/backup-mollie-data.ts
 */
import { createMollieClient } from '@mollie/api-client';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnv('.env.local');
loadEnv('.env');

const apiKey = process.env.MOLLIE_API_KEY;
if (!apiKey || apiKey.startsWith('test_')) {
  console.error('Set MOLLIE_API_KEY to a live_ key. Current value looks like a test key.');
  process.exit(1);
}

const mollie = createMollieClient({ apiKey });

async function main() {
  console.log('Starting Mollie data backup…\n');

  const customers: unknown[] = [];
  const subscriptions: unknown[] = [];
  const payments: unknown[] = [];

  // Customers + their subscriptions
  let customerCount = 0;
  for await (const customer of mollie.customers.iterate()) {
    customerCount++;
    customers.push(customer);

    try {
      const subs = await mollie.customerSubscriptions.page({ customerId: customer.id });
      for (const sub of subs) {
        subscriptions.push({ ...sub, _customerId: customer.id, _customerEmail: customer.email });
      }
    } catch {
      // customer might have no subscriptions
    }

    if (customerCount % 10 === 0) process.stdout.write(`  customers scanned: ${customerCount}\r`);
  }
  console.log(`\n  ✓ ${customerCount} customers`);
  console.log(`  ✓ ${subscriptions.length} subscriptions`);

  // Recent payments (last 250 — Mollie caps list at 250 per page)
  const paymentPage = await mollie.payments.page({ limit: 250 });
  for (const p of paymentPage) payments.push(p);
  console.log(`  ✓ ${payments.length} recent payments (last 250)`);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = join('scripts', 'backups');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, `mollie-backup-${timestamp}.json`);

  writeFileSync(outPath, JSON.stringify({ customers, subscriptions, payments }, null, 2));
  console.log(`\nBackup saved to: ${outPath}`);
  console.log(`  ${customers.length} customers, ${subscriptions.length} subscriptions, ${payments.length} payments`);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
