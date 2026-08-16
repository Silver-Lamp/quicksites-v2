// app/api/admin/heroes/pool-fill/route.ts
//
// Fill an industry's painterly hero pool. THIS ROUTE SPENDS MONEY — ~$0.04 per image — so it is
// admin-only, flag-gated, and takes an explicit count rather than "fill it up".
//
// Deliberately NOT a cron. The backdrop pool has one because backdrops are wanted fleet-wide;
// painterly heroes default to four small verticals, so topping them up is a decision someone
// makes on purpose a handful of times, not a thing that should quietly run nightly. A scheduled
// job that spends is exactly the shape of cost nobody notices until the invoice.

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireUser';
import {
  fillHeroPool,
  listHeroPool,
  heroPoolEnabled,
  HERO_POOL_TARGET,
  PAINTERLY_HERO_INDUSTRIES,
} from '@/lib/theme/heroPool';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// gpt-image-1 is ~20s per image; a small batch needs the headroom.
export const maxDuration = 300;

/** Hard ceiling per request, so a typo in `count` cannot become a large bill. */
const MAX_PER_REQUEST = 6;

export async function GET() {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  const industries = [...PAINTERLY_HERO_INDUSTRIES];
  const pools = await Promise.all(
    industries.map(async (k) => ({ industry: k, count: (await listHeroPool(k)).length })),
  );

  return NextResponse.json({
    ok: true,
    enabled: heroPoolEnabled(),
    target: HERO_POOL_TARGET,
    approxCostPerImageUsd: 0.04,
    pools,
  });
}

export async function POST(req: Request) {
  const gate = await requireAdmin();
  if (gate instanceof NextResponse) return gate;

  if (!heroPoolEnabled()) {
    return NextResponse.json(
      { error: 'Hero pool is off. Set HERO_POOL_ENABLED=1 to allow spending on hero images.' },
      { status: 409 },
    );
  }

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const industry = String(body?.industry || '').trim();
  if (!PAINTERLY_HERO_INDUSTRIES.has(industry)) {
    return NextResponse.json(
      { error: `industry must be one of: ${[...PAINTERLY_HERO_INDUSTRIES].join(', ')}` },
      { status: 400 },
    );
  }

  const requested = Number(body?.count ?? 1);
  const count = Math.max(1, Math.min(Number.isFinite(requested) ? requested : 1, MAX_PER_REQUEST));

  const result = await fillHeroPool(industry, count, gate.user.id);
  return NextResponse.json({
    ok: true,
    ...result,
    // Report what was actually spent, not what was asked for — a partial run is the common case
    // (the fill stops on first failure rather than retrying into the budget).
    approxSpentUsd: Number((result.added * 0.04).toFixed(2)),
  });
}
