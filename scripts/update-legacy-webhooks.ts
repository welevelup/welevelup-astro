/**
 * One-shot script to update the `webhookUrl` of every active recurring
 * subscription in the LEGACY Mollie organisation (the one used by GiveWP).
 *
 * Why this exists:
 *   When DNS for welevelup.org is cut over to Vercel, the existing 70 GiveWP
 *   subscriptions still send their webhooks to https://welevelup.org/?give-
 *   listener=mollie. That URL will now hit Vercel, which doesn't speak the
 *   GiveWP webhook protocol — so the webhooks 404 and Mollie eventually
 *   pauses the subscriptions / spams the admin.
 *
 *   This script walks every active subscription in the legacy org and
 *   rewrites its webhookUrl to point at the Cloudways URL where the WP
 *   install (and the GiveWP handler) still lives.
 *
 * Run this BEFORE the DNS cutover. It is safe to run multiple times — Mollie
 * accepts identical PATCHes without side effects.
 *
 * Usage:
 *   1. Set MOLLIE_LEGACY_API_KEY and MOLLIE_LEGACY_WEBHOOK_URL in .env.local
 *   2. Run:  npx tsx scripts/update-legacy-webhooks.ts --dry-run
 *   3. Verify the report
 *   4. Run:  npx tsx scripts/update-legacy-webhooks.ts --apply
 *
 * After it succeeds, you can remove MOLLIE_LEGACY_API_KEY from .env.local —
 * we no longer need it for day-to-day operation.
 */
import { createMollieClient, SubscriptionStatus } from '@mollie/api-client';
import { readFileSync, existsSync } from 'node:fs';

// Tiny .env.local loader so we don't need a dotenv dep
function loadEnv(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
}
loadEnv('.env.local');

const apiKey = process.env.MOLLIE_LEGACY_API_KEY;
const newWebhookUrl = process.env.MOLLIE_LEGACY_WEBHOOK_URL;

if (!apiKey || !newWebhookUrl) {
  console.error(
    'Missing MOLLIE_LEGACY_API_KEY or MOLLIE_LEGACY_WEBHOOK_URL in .env.local'
  );
  process.exit(1);
}

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const dryRun = args.has('--dry-run') || !apply;

if (!apply && !dryRun) {
  console.log('Pass --dry-run to preview, or --apply to actually update.');
  process.exit(0);
}

console.log(
  `Mode: ${apply ? 'APPLY (will modify Mollie data)' : 'DRY RUN (no changes)'}`
);
console.log(`Target webhookUrl: ${newWebhookUrl}\n`);

const mollie = createMollieClient({ apiKey });

interface Row {
  customerId: string;
  subscriptionId: string;
  amount: string;
  status: string;
  oldWebhookUrl: string | undefined;
  action: 'update' | 'skip';
  error?: string;
}

async function main() {
  // Iterate every customer, then their subscriptions. The Mollie SDK paginates
  // automatically when you `for await` over the result.
  const rows: Row[] = [];
  let customerCount = 0;
  let activeSubCount = 0;

  for await (const customer of mollie.customers.iterate()) {
    customerCount++;
    let subs;
    try {
      subs = await mollie.customerSubscriptions.page({
        customerId: customer.id,
      });
    } catch (err) {
      console.error(`  ! could not list subs for ${customer.id}:`, err);
      continue;
    }
    for (const sub of subs) {
      if (sub.status !== SubscriptionStatus.active) continue;
      activeSubCount++;
      const row: Row = {
        customerId: customer.id,
        subscriptionId: sub.id,
        amount: `${sub.amount.currency} ${sub.amount.value}`,
        status: sub.status,
        oldWebhookUrl: sub.webhookUrl ?? undefined,
        action: sub.webhookUrl === newWebhookUrl ? 'skip' : 'update',
      };

      if (row.action === 'update' && apply) {
        try {
          await mollie.customerSubscriptions.update(sub.id, {
            customerId: customer.id,
            webhookUrl: newWebhookUrl,
          });
        } catch (err) {
          row.error = err instanceof Error ? err.message : String(err);
        }
      }

      rows.push(row);
    }
  }

  console.log(
    `Scanned ${customerCount} customers, found ${activeSubCount} active subscriptions.\n`
  );
  for (const row of rows) {
    const tag = row.error ? 'ERROR' : row.action.toUpperCase();
    console.log(
      `  [${tag}] ${row.subscriptionId}  ${row.amount}  customer=${row.customerId}`
    );
    if (row.oldWebhookUrl) console.log(`         old: ${row.oldWebhookUrl}`);
    if (row.error) console.log(`         err: ${row.error}`);
  }

  const updated = rows.filter((r) => r.action === 'update' && !r.error).length;
  const skipped = rows.filter((r) => r.action === 'skip').length;
  const failed = rows.filter((r) => r.error).length;

  console.log('');
  console.log(`Result: ${updated} ${apply ? 'updated' : 'would-update'}, ${skipped} already-correct, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
