// app/api/cron/backdrop-pool-fill/route.ts
//
// Tops up the per-industry painterly backdrop pools (lib/theme/backdropPool.ts) a few
// images at a time, out of band.
//
// This is the ONLY thing that fills a pool. Site creation never generates — it reads the
// pool if there's something in it and falls back to a CSS backdrop otherwise, so nobody
// ever waits ~20s on gpt-image-1 to see their new site.
//
// Two independent brakes on spend, because this is the one cron that costs money per run:
//   • `BACKDROP_POOL_ENABLED` — OFF by default; the cron no-ops entirely when unset.
//   • `maxPerRun` — a hard per-invocation cap (default 5 ≈ $0.20/run), separate from the
//     per-industry POOL_TARGET cap. Even a misconfigured schedule can't run away.
//
// Which industries get filled is demand-driven: only industries that actually have sites,
// rarest-pool-first, so the money follows real usage instead of pre-painting all ~43.
//
// POST/GET (cron-authorized) { maxPerRun?, industryKey? }

import { NextResponse } from 'next/server';
import { isCronAuthorized } from '@/lib/cron/auth';
import { runCron } from '@/lib/cron/record';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { backdropPoolEnabled, fillPool, listPool, POOL_TARGET } from '@/lib/theme/backdropPool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // several ~20s generations per run

async function handler(req: Request): Promise<Response> {
  if (!backdropPoolEnabled()) {
    return NextResponse.json({ ok: true, skipped: 'BACKDROP_POOL_ENABLED is off', filled: 0 });
  }

  const url = new URL(req.url);
  const maxPerRun = Math.min(Math.max(Number(url.searchParams.get('maxPerRun')) || 5, 1), 20);
  const only = url.searchParams.get('industryKey');

  // Demand-driven: industries that actually have templates. No point pre-painting a pool
  // for an industry nobody has built in.
  let industries: string[] = [];
  if (only) {
    industries = [only];
  } else {
    const { data } = await supabaseAdmin
      .from('templates')
      .select('industry')
      .not('industry', 'is', null)
      .limit(2000);
    const counts = new Map<string, number>();
    for (const r of (data ?? []) as any[]) {
      const k = String(r.industry || '').trim();
      if (k) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    industries = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  }

  const results: any[] = [];
  let budget = maxPerRun;

  // Rarest pool first, so every industry reaches a usable handful before any reaches 25.
  const withCounts = await Promise.all(
    industries.map(async (k) => ({ k, n: (await listPool(k)).length })),
  );
  withCounts.sort((a, b) => a.n - b.n);

  for (const { k, n } of withCounts) {
    if (budget <= 0) break;
    if (n >= POOL_TARGET) continue;
    const r = await fillPool(k, Math.min(budget, 2), null);
    budget -= r.added;
    if (r.added > 0 || r.reason) results.push(r);
  }

  const filled = results.reduce((s, r) => s + (r.added ?? 0), 0);
  return NextResponse.json({ ok: true, filled, target: POOL_TARGET, results });
}

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('backdrop-pool-fill', () => handler(req));
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return runCron('backdrop-pool-fill', () => handler(req));
}
