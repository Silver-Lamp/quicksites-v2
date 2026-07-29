// app/api/public/menu-search-log/route.ts
//
// Record what someone looked for on a city menu directory, and how many dishes they found.
//
// The zero-result rows are the product: "47 people searched for vegan pad thai near you and
// found nobody serving it" is revenue that doesn't exist yet, and no incumbent sells it. The
// menu-finder filters client-side, so without this every "no results" evaporated.
//
// ⚠️ NO PII, BY CONSTRUCTION. The row has no user id, no session id, no IP — the unit is a
// SEARCH, not a searcher. The product is an aggregate, so per-person data adds nothing a count
// doesn't while adding every obligation of holding it. Do not add an identifier here to make
// some later funnel analysis easier; that is a different product with a different consent
// story.
//
// Best-effort by design: the caller uses sendBeacon and ignores the response. A dropped search
// log must never be visible to a hungry visitor.
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_QUERY = 120;
const MAX_TAGS = 12;

export async function POST(req: Request) {
  // Generous: a real visitor refines a search several times in a sitting, and the client
  // already debounces. This is an abuse ceiling, not a usage budget.
  const limited = await rateLimitOr429(req, 'menu-search-log', 120, 3600);
  if (limited) return limited;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const campaignId = String(body?.campaignId || '').trim();
  const resultCount = Number(body?.resultCount);
  if (!campaignId || !Number.isFinite(resultCount) || resultCount < 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Confirm the campaign exists before writing — otherwise this is an open insert keyed on
  // an attacker-supplied uuid, and the FK would reject it anyway with a noisier failure.
  const { data: campaign } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, city')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return NextResponse.json({ ok: false }, { status: 404 });

  const query = String(body?.query ?? '').trim().toLowerCase().slice(0, MAX_QUERY);
  const tags = Array.isArray(body?.tags)
    ? body.tags.map((t: any) => String(t).trim().toLowerCase()).filter(Boolean).slice(0, MAX_TAGS)
    : [];

  // Nothing to learn from an empty search with no tags — that's just the page loading.
  if (!query && !tags.length) return NextResponse.json({ ok: true, skipped: 'empty' });

  await supabaseAdmin.from('menu_search_events').insert({
    campaign_id: campaignId,
    city: (campaign as any).city ?? null,
    query: query || null,
    tags,
    result_count: Math.min(resultCount, 100000),
    open_only: !!body?.openOnly,
  });

  return NextResponse.json({ ok: true });
}
