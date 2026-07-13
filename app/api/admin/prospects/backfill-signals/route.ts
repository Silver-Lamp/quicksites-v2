// app/api/admin/prospects/backfill-signals/route.ts
//
// On-demand Place Details signal backfill for ALREADY-swept prospects (so the buy-list
// map-pack scoring gets competitor-review data without re-sweeping). Admin-gated, explicit
// (an operator chose to spend the paid SKU), bounded + 7-day-throttled by backfillPlaceSignals.
// See docs/DOMAIN_ACQUISITION_PLAN.md.

import { NextResponse } from 'next/server';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { backfillPlaceSignals } from '@/lib/outreach/placeSignals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // may fetch a few hundred Place Details

type Body = {
  /** Restrict to one sweep. */
  sweepId?: string;
  /** Restrict to a city (case-insensitive exact). */
  city?: string;
  /** Restrict to an industry. */
  industryKey?: string;
  /** Max Place Details calls this run (bounds cost; default 200). */
  limit?: number;
};

export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    body = {};
  }

  const limit = Math.min(Math.max(1, Number(body.limit) || 200), 1000);

  // Gather candidate place_ids by filter (cap the scan generously; the paid work is capped
  // by `limit` + the TTL inside backfillPlaceSignals).
  let q = supabaseAdmin
    .from('outreach_prospects')
    .select('place_id')
    .not('place_id', 'is', null)
    .order('place_signals_synced_at', { ascending: true, nullsFirst: true })
    .limit(2000);
  if (body.sweepId) q = q.eq('sweep_id', body.sweepId);
  if (body.city) q = q.ilike('city', body.city);
  if (body.industryKey) q = q.eq('industry_key', body.industryKey);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const placeIds = (data ?? []).map((r: any) => r.place_id as string).filter(Boolean);
  const result = await backfillPlaceSignals(placeIds, { limit });

  if (!result.configured) {
    return NextResponse.json(
      { ok: false, error: 'place_details_not_configured', detail: 'Set GOOGLE_PLACES_API_KEY.', result },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, scanned: placeIds.length, result });
}
