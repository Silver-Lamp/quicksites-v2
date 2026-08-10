// app/api/public/city-nearby/route.ts
//
// The zero-result fallback: real restaurants in this city that we do NOT host.
//
// GET ?campaign=<id>&q=<query>  → { city, matches[] }
//
// ⚠️ ONLY CALLED WHEN THE INDEX HAS NOTHING. This is deliberately a second request rather than
// part of the search payload: it costs a query per zero-result instead of a query per keystroke,
// and it keeps the honest-answer path and the we-have-nothing path visibly separate in the code.
//
// ⚠️ READS OUR OWN SWEEP, NEVER A THIRD PARTY. `outreach_prospects` is already-collected
// lead-gen data. A live Places lookup here would be a per-visitor charge on a public endpoint —
// a cost amplifier anyone could point a loop at — for an answer we already have locally.
//
// Public, read-only, rate-limited. Returns only what a diner needs: name, phone, address.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { loadCompetitionDirectoryByCampaignId } from '@/lib/outreach/restaurantCompetitionDirectory';
import { findNearbyOffPlatform, queryTerms } from '@/lib/menu/nearbyOffPlatform';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const limited = await rateLimitOr429(req, 'city-nearby', 60, 300);
  if (limited) return limited;

  const url = new URL(req.url);
  const campaign = (url.searchParams.get('campaign') || '').trim();
  const q = (url.searchParams.get('q') || '').trim();
  if (!campaign) return NextResponse.json({ error: 'campaign is required' }, { status: 400 });
  // No terms → no query. Bailing before the DB read keeps an empty box from scanning the table.
  if (!queryTerms(q).length) return NextResponse.json({ matches: [] });

  const dir = await loadCompetitionDirectoryByCampaignId(campaign);
  if (!dir) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const { data: prospects } = await supabaseAdmin
    .from('outreach_prospects')
    .select('id, business_name, phone, address, city, region, categories, website, rating, review_count')
    .ilike('city', dir.city)
    .limit(500);

  const matches = findNearbyOffPlatform((prospects ?? []) as any[], {
    query: q,
    city: dir.city,
    region: dir.region,
    limit: 4,
  });

  // `noWebsite` is stripped: it is an operator signal about a sales opportunity, and a diner-facing
  // payload has no business carrying our view of whether a restaurant is a lead.
  return NextResponse.json({
    city: dir.city,
    region: dir.region,
    matches: matches.map(({ noWebsite, ...m }) => m),
  });
}
