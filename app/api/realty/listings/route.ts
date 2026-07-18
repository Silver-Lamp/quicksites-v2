// app/api/realty/listings/route.ts
//
// Server-side IDX listings proxy (docs/REALTY_IDX_PLAN.md). A buyer's listing_search block calls
// GET /api/realty/listings?site=<slug>&city=…&maxPrice=… — the proxy resolves the agent's feed
// config from the template (credentials stay here, never in the browser), queries the provider,
// and returns normalized listings + the MLS-mandated compliance block. Flag-gated: returns
// { disabled: true } when IDX isn't enabled/configured (in prod) so the block degrades gracefully.
// Rate-limited (public endpoint). Serves the mock feed in dev/demo when no real feed is configured.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { searchListings } from '@/lib/realty/idx';
import { clampLimit, type ListingSearch, type ListingStatus } from '@/lib/realty/idx/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const numParam = (v: string | null): number | undefined => {
  if (v == null || v === '') return undefined;
  const n = Number(v.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : undefined;
};

export async function GET(req: NextRequest) {
  const limited = await rateLimitOr429(req, 'realty-listings', 60, 3600);
  if (limited) return limited;

  const url = new URL(req.url);
  const site = (url.searchParams.get('site') || '').trim();
  if (!site) return NextResponse.json({ error: 'Missing site slug.' }, { status: 400 });

  const { data: template } = await supabaseAdmin
    .from('templates')
    .select('id, data')
    .eq('slug', site)
    .maybeSingle();
  if (!template) return NextResponse.json({ error: 'Site not found.' }, { status: 404 });

  const statusRaw = url.searchParams.get('status');
  const params: ListingSearch = {
    q: url.searchParams.get('q') || undefined,
    city: url.searchParams.get('city') || undefined,
    postal: url.searchParams.get('postal') || undefined,
    minPrice: numParam(url.searchParams.get('minPrice')),
    maxPrice: numParam(url.searchParams.get('maxPrice')),
    minBeds: numParam(url.searchParams.get('minBeds')),
    minBaths: numParam(url.searchParams.get('minBaths')),
    status: (['active', 'pending', 'sold'].includes(statusRaw ?? '') ? statusRaw : undefined) as
      | ListingStatus
      | undefined,
    limit: clampLimit(url.searchParams.get('limit')),
    offset: numParam(url.searchParams.get('offset')),
  };

  const outcome = await searchListings(template, params);
  if (!outcome.ok) {
    if (outcome.reason === 'disabled' || outcome.reason === 'not_configured') {
      return NextResponse.json({ disabled: true, listings: [], total: 0 });
    }
    return NextResponse.json(
      { error: outcome.message || 'Listings unavailable.' },
      { status: 502 }
    );
  }
  return NextResponse.json(outcome.result, { headers: { 'Cache-Control': 'public, max-age=120' } });
}
