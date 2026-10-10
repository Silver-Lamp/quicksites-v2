// app/api/rep/build-draft/route.ts
//
// One click on a rep's page → a draft site for a swept business, built the same way the admin
// "Build" button builds it (listing → menu OCR → scaffold → parked on the prospect). The rep
// is not an admin and usually has no account; they hold a signed grant minted into their page
// (lib/rep/repActionToken.ts). Three bounds, all server-side: the grant must verify and name an
// active code, the code may build REP_BUILDS_PER_DAY drafts a day, and the IP is throttled.
//
// ⚠️ IT BUILDS ONLY WHAT THE SWEEP ALREADY PARKED. A prospect id, never a name or a URL typed
// by the rep, so nothing here can be pointed at a business we have not observed — and the
// prospect's own industry is passed through, for the reason the admin route explains at length
// (the fallback guesses `restaurant` and gives a mechanic a menu).
import { NextResponse } from 'next/server';
import { verifyRepActionToken } from '@/lib/rep/repActionToken';
import { repBuildLinks, REP_BUILDS_PER_DAY } from '@/lib/rep/repBuild';
import { codeIsUsable } from '@/lib/referrals/codes';
import { getProspect, markProspectBuilt } from '@/lib/outreach/prospects';
import { buildDraftFromListing, BuildDraftError } from '@/lib/outreach/buildDraftFromListing';
import { buildDraftFromSite, BuildFromSiteError } from '@/lib/outreach/buildDraftFromSite';
import { listingForProspect } from '@/lib/outreach/listingForProspect';
import { checkRateLimit } from '@/lib/rateLimit';
import { rateLimitOr429 } from '@/lib/api/rateLimitGuard';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { publicBaseUrl } from '@/lib/outreach/competitionPoster';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // vision OCR for a restaurant listing

export async function POST(req: Request) {
  const limited = await rateLimitOr429(req, 'rep-build-draft', 30, 3600);
  if (limited) return limited;

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const grant = verifyRepActionToken(typeof body.token === 'string' ? body.token : null);
  if (!grant) return NextResponse.json({ error: 'bad_token' }, { status: 403 });
  const code = grant.code;
  if (!(await codeIsUsable(code))) return NextResponse.json({ error: 'code_inactive' }, { status: 403 });

  const prospectId = typeof body.prospectId === 'string' ? body.prospectId.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(prospectId)) return NextResponse.json({ error: 'prospect_required' }, { status: 400 });

  const p = await getProspect(prospectId);
  if (!p) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const base = publicBaseUrl();
  const menuHost = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null;

  // Already built — hand back the links; a second click must never mint a second draft.
  if (p.template_id) {
    const { data: t } = await supabaseAdmin.from('templates').select('slug').eq('id', p.template_id).maybeSingle();
    if (t?.slug) {
      return NextResponse.json({ ok: true, alreadyBuilt: true, ...repBuildLinks({ slug: t.slug, industryKey: p.industry_key ?? null, prospectId, code, base, menuHost }) });
    }
  }

  const cap = await checkRateLimit(`rep-build:${code}`, REP_BUILDS_PER_DAY, 24 * 3600);
  if (!cap.ok) return NextResponse.json({ error: 'daily_cap', limit: cap.limit }, { status: 429 });

  // The draft's owner is the operator who swept the business (the cron does the same), never
  // the rep — the rep has no account, and ownership transfers to the business on claim.
  const { data: who } = await supabaseAdmin.from('outreach_prospects').select('discovered_by').eq('id', prospectId).maybeSingle();
  const operatorId = (who as { discovered_by?: string | null } | null)?.discovered_by || process.env.TRADE_PIPELINE_OPERATOR_ID || null;
  if (!operatorId) return NextResponse.json({ error: 'no_operator' }, { status: 500 });

  // mode 'from_site': the restaurant HAS a website and takes no online orders — build the
  // ordering draft from the menu it already published (lib/outreach/buildDraftFromSite.ts), not
  // from listing photos. Still only a parked prospect by id, and only one with a website of its
  // own; the route never scrapes a URL the rep typed.
  const mode = body.mode === 'from_site' ? 'from_site' : 'listing';
  if (mode === 'from_site') {
    if (p.industry_key !== 'restaurant') return NextResponse.json({ error: 'not_a_restaurant' }, { status: 400 });
    if (!p.website) return NextResponse.json({ error: 'no_website' }, { status: 400 });
    try {
      const built = await buildDraftFromSite({ website: p.website, operatorId, fallbackName: p.business_name, fallbackPhone: p.phone });
      await markProspectBuilt(prospectId, built.id);
      return NextResponse.json({
        ok: true,
        alreadyBuilt: false,
        mode,
        menuSource: built.summary.menuItems > 0 ? 'site' : 'none',
        menuItems: built.summary.menuItems,
        ...repBuildLinks({ slug: built.slug, industryKey: 'restaurant', prospectId, code, base, menuHost }),
      });
    } catch (e) {
      const code2 = e instanceof BuildFromSiteError ? e.code : 'build_failed';
      return NextResponse.json({ error: code2, detail: e instanceof Error ? e.message : undefined }, { status: 502 });
    }
  }

  try {
    const listing = await listingForProspect(p);
    const built = await buildDraftFromListing({ listing, operatorId, industryKey: (p.industry_key as any) || undefined });
    await markProspectBuilt(prospectId, built.id);
    const hasMenu = built.summary.menuItems > 0;
    return NextResponse.json({
      ok: true,
      alreadyBuilt: false,
      mode,
      menuSource: built.industryKey === 'restaurant' ? (hasMenu ? 'auto' : 'none') : 'n/a',
      ...repBuildLinks({ slug: built.slug, industryKey: built.industryKey, prospectId, code, base, menuHost }),
    });
  } catch (e) {
    const msg = e instanceof BuildDraftError ? e.message : 'build_failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
