/**
 * scripts/fill-backdrop-pools.ts
 *
 * Fill per-industry painterly backdrop pools (lib/theme/backdropPool.ts) to POOL_TARGET, for a
 * named list of industries, under a HARD SPEND CEILING.
 *
 * ⚠️ THIS SPENDS REAL MONEY — one gpt-image-1 render per image, ~$0.05 measured (not the $0.04
 * the older comments estimate; the metered ledger is the number to trust). It is DRY-RUN BY
 * DEFAULT and requires an explicit `--budget` in dollars.
 *
 * Why this exists alongside the `backdrop-pool-fill` cron: the cron is demand-driven and
 * deliberately slow (5 images/run, once a day), which is right for unattended spend but means an
 * industry takes five days to reach a usable pool. This is the attended version — an operator
 * choosing to spend a known amount now, on industries they name.
 *
 * The ceiling is enforced two ways, because one of them is a guess:
 *   • an IMAGE COUNT derived from the budget at an assumed unit cost (deterministic, pre-flight)
 *   • a re-check of the ACTUAL metered spend from ai_usage_events every few images, which stops
 *     the run if real costs come in higher than assumed. The first is the plan; the second is
 *     what makes the plan safe when the assumption is wrong.
 *
 *   npx tsx scripts/fill-backdrop-pools.ts <industry>...                    # dry run
 *   npx tsx scripts/fill-backdrop-pools.ts --budget 10 <industry>...        # spends
 */
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '../../../.env.local' });
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const ARGS = process.argv.slice(2);
const APPLY = ARGS.includes('--budget');
const BUDGET_USD = (() => {
  const i = ARGS.indexOf('--budget');
  return i === -1 ? 0 : Number(ARGS[i + 1] || 0);
})();
const INDUSTRIES = ARGS.filter((a, i) => !a.startsWith('--') && ARGS[i - 1] !== '--budget');

/** Measured on 2026-08-14 across 54 renders: $2.70 / 54 = $0.05. */
const ASSUMED_USD_PER_IMAGE = 0.05;

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)!,
    { auth: { persistSession: false } },
  );
}

/** Actual spend since a timestamp, straight from the meter. */
async function spentSince(db: any, sinceIso: string): Promise<number> {
  const { data } = await db
    .from('ai_usage_events')
    .select('cost_usd')
    .gte('occurred_at', sinceIso);
  return (data ?? []).reduce((n: number, r: any) => n + Number(r.cost_usd || 0), 0);
}

async function main() {
  const { listPool, fillPool, POOL_TARGET, backdropPoolEnabled } = await import('@/lib/theme/backdropPool');

  if (!INDUSTRIES.length) {
    console.error('Name at least one industry key. Nothing runs without them.');
    process.exit(1);
  }
  if (APPLY && (!Number.isFinite(BUDGET_USD) || BUDGET_USD <= 0)) {
    console.error('--budget must be a positive number of dollars.');
    process.exit(1);
  }
  if (APPLY && !backdropPoolEnabled()) {
    // Fail rather than silently generate into a pool nothing will read.
    console.error('BACKDROP_POOL_ENABLED is not set locally — pickPoolBackdrop() would ignore these.');
    process.exit(1);
  }

  const db = admin();
  const startedAt = new Date().toISOString();
  const maxImages = APPLY ? Math.floor(BUDGET_USD / ASSUMED_USD_PER_IMAGE) : 0;

  console.log(
    `${APPLY ? 'APPLYING' : 'DRY RUN'} · target ${POOL_TARGET}/industry · ` +
      `budget $${BUDGET_USD.toFixed(2)} ≈ ${maxImages} images @ $${ASSUMED_USD_PER_IMAGE}\n`,
  );

  // Pre-flight: how much room is there, and what would it cost?
  const plan: Array<{ key: string; have: number; room: number }> = [];
  for (const key of INDUSTRIES) {
    const have = (await listPool(key)).length;
    plan.push({ key, have, room: Math.max(0, POOL_TARGET - have) });
  }
  const totalRoom = plan.reduce((n, p) => n + p.room, 0);
  for (const p of plan) console.log(`  ${p.key.padEnd(22)} ${p.have}/${POOL_TARGET}  → room ${p.room}`);
  console.log(
    `\n  total room ${totalRoom} images ≈ $${(totalRoom * ASSUMED_USD_PER_IMAGE).toFixed(2)}` +
      (APPLY && totalRoom > maxImages ? `  — budget covers ${maxImages}, so this stops short.` : ''),
  );

  if (!APPLY) {
    console.log('\nDry run — nothing generated. Re-run with --budget <dollars> to spend.');
    return;
  }

  let made = 0;
  // Round-robin rather than draining one industry at a time: if the budget runs out early,
  // several industries are partly better off instead of one being perfect and the rest untouched.
  let progress = true;
  while (made < maxImages && progress) {
    progress = false;
    for (const p of plan) {
      if (made >= maxImages) break;
      if (p.room <= 0) continue;

      const res = await fillPool(p.key, 1, null);
      const added = res.added ?? 0;
      if (added > 0) {
        made += added;
        p.room -= added;
        progress = true;
        process.stdout.write(`\r  generated ${made}/${maxImages} …`);
      } else {
        p.room = 0; // full, or failing — either way stop asking
      }

      // Re-check the real meter periodically. The image count is a plan built on an assumed
      // unit cost; this is the part that holds when the assumption is wrong.
      if (made % 10 === 0 && made > 0) {
        const spent = await spentSince(db, startedAt);
        if (spent >= BUDGET_USD) {
          console.log(`\n\n  ⛔ stopping: metered spend $${spent.toFixed(2)} reached the $${BUDGET_USD.toFixed(2)} budget.`);
          progress = false;
          break;
        }
      }
    }
  }

  const spent = await spentSince(db, startedAt);
  console.log(`\n\n  done · ${made} images · metered $${spent.toFixed(2)} of $${BUDGET_USD.toFixed(2)}`);
  for (const p of plan) {
    const have = (await listPool(p.key)).length;
    console.log(`  ${p.key.padEnd(22)} now ${have}/${POOL_TARGET}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
