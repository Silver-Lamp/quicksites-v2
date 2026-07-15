// scripts/backfill-seo-readiness.ts
//
// Populate templates.seo_readiness_pct / seo_readiness for existing rows so the
// templates/sites list can sort by SEO readiness with a plain ORDER BY (no cap).
// Going forward the score is refreshed on every commit; this seeds history.
//
//   npm run backfill:seo            # dry run — scan + report, writes nothing
//   npm run backfill:seo -- --apply # compute + persist via set_template_seo RPC
//   npm run backfill:seo -- --apply --limit 500
//
// Idempotent: recomputes + overwrites, so re-running just refreshes. Writes through
// the set_template_seo RPC (bypasses the templates update guard, touches only the
// two score columns — no updated_at churn).

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

// supabase-js pulls in realtime, which needs a WebSocket global on Node < 22.
if (typeof (globalThis as any).WebSocket === 'undefined') {
  try {
    // @ts-expect-error - `ws` ships no bundled types; runtime-only polyfill for Node 20
    const ws = (await import('ws')).default;
    (globalThis as any).WebSocket = ws;
  } catch {
    /* ignore */
  }
}

import { createClient } from '@supabase/supabase-js';
import { readinessScore } from '@/lib/outreach/readiness';
import { resolveIndustryKey } from '@/lib/industries';

const PAGE = 200;

async function main() {
  const apply = process.argv.includes('--apply');
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg >= 0 ? Math.max(0, parseInt(process.argv[limitArg + 1] || '0', 10)) : 0;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in env.');
    process.exit(1);
  }
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n▶ Backfilling SEO readiness (${apply ? 'APPLY' : 'DRY RUN'}${limit ? `, limit ${limit}` : ''})…\n`);

  const stats = { scanned: 0, written: 0, errors: 0 };
  const buckets = { '0-49': 0, '50-79': 0, '80-100': 0 };
  let cursor: string | null = null;

  for (;;) {
    if (limit && stats.written >= limit) break;

    let q = db
      .from('templates')
      .select('id, industry, data')
      .order('id', { ascending: true })
      .limit(PAGE);
    if (cursor) q = q.gt('id', cursor);

    const { data: rows, error } = await q;
    if (error) { console.error('❌ template query failed:', error.message); process.exit(1); }
    if (!rows || rows.length === 0) break;
    cursor = (rows[rows.length - 1] as any).id;

    for (const t of rows as any[]) {
      stats.scanned++;
      const meta = t?.data?.meta ?? {};
      const rawIndustry = t.industry ?? meta?.identity?.industry ?? meta?.industry ?? '';
      const score = readinessScore(t.data ?? {}, resolveIndustryKey(rawIndustry));
      if (score.pct < 50) buckets['0-49']++; else if (score.pct < 80) buckets['50-79']++; else buckets['80-100']++;

      if (apply) {
        const { error: rpcErr } = await (db as any)
          .schema('public')
          .rpc('set_template_seo', { p_id: t.id, p_pct: score.pct, p_detail: score });
        if (rpcErr) { stats.errors++; console.error(`  ⚠ ${t.id}: ${rpcErr.message}`); }
        else stats.written++;
      }
      if (limit && stats.written >= limit) break;
    }
  }

  console.log(
    `\n✅ Done. scanned=${stats.scanned}, written=${apply ? stats.written : '(dry run)'}, errors=${stats.errors}`
  );
  console.log(`   distribution — <50%: ${buckets['0-49']} · 50–79%: ${buckets['50-79']} · 80%+: ${buckets['80-100']}\n`);
  if (!apply) console.log('Re-run with `-- --apply` to write.\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
