// app/api/public/demo-cohort/route.ts
//
// The current generated-demo cohort, as ABSOLUTE URLs with an industry tag.
//
// ⚠️ WHY THIS EXISTS RATHER THAN REUSING /api/public/showcase. HiveJournal's browsing personas
// test a QuickSites-generated site, and their target was pinned to a slug. We retired that site
// (it was pre-refresh output), so three persona runs went into a URL that had stopped existing —
// the last one could only ever report a 404. HJ asked for a feed they could resolve at run time
// instead of chasing our retirements.
//
// `/api/public/showcase` cannot serve that, and HJ's read of it was correct:
//   • `href` is mixed — some absolute external domains (https://www.graftontowing.com), some
//     relative paths (/sites/local). There is no single field you can point a browser at.
//   • its slugs are a DIFFERENT SET from the generated cohort. It is the curated marketing
//     showcase — real customer sites — not the auto-generated demos.
//   • `industry` is inconsistently cased there ('Towing' vs 'pest_control').
//
// So this is a small, purpose-built feed: absolute `url`, a normalized `industry` key, and a
// human `industryLabel` so a persona's goal can stay matched to the trade ("you run a towing
// business" against a towing demo).
//
// ⚠️ IT LISTS ONLY WHAT IS ACTUALLY SERVING. Liveness comes from a `published_sites` row, NOT
// from `templates.published` or `archived` — the public renderer reads the published_sites
// pointer and ignores those flags, so a template can read "published: false" and still serve, or
// be archived and still serve. Deriving liveness from the flags is exactly how a consumer ends
// up pointed at a dead URL again.
//
// Public and safe by construction: these are our own demo businesses, invented by us. There is
// no customer data here, and nothing is exposed that isn't already reachable by visiting the
// sites themselves.
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { KEY_TO_LABEL } from '@/lib/industries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ORIGIN_SUFFIX = '.quicksites.ai';

/** Prefer the canonical label; fall back to a readable form so an unknown key never renders raw. */
function labelFor(key: string): string {
  return (
    (KEY_TO_LABEL as Record<string, string>)[key] ??
    key.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
  );
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    // Degrade to an empty cohort rather than a 500: a consumer polling this should see
    // "nothing to test right now", not an error it has to special-case.
    return NextResponse.json({ ok: true, count: 0, sites: [] });
  }

  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: templates, error } = await db
    .from('templates')
    .select('id, slug, industry, template_name')
    .eq('claim_source', 'demo_seed')
    .eq('archived', false);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const ids = (templates ?? []).map((t: any) => t.id);
  if (!ids.length) return NextResponse.json({ ok: true, count: 0, sites: [] });

  // One query, not one per template — this is a public endpoint and a fan-out here would be a
  // free way for anyone to make us do N round-trips.
  const { data: published } = await db
    .from('published_sites')
    .select('template_id')
    .in('template_id', ids);
  const liveIds = new Set((published ?? []).map((p: any) => p.template_id));

  const sites = (templates ?? [])
    .filter((t: any) => t.slug && liveIds.has(t.id))
    .map((t: any) => ({
      slug: t.slug,
      url: `https://${t.slug}${ORIGIN_SUFFIX}/`,
      industry: t.industry ?? null,
      industryLabel: t.industry ? labelFor(t.industry) : null,
      name: t.template_name ?? null,
    }))
    .sort((a, b) => String(a.industry).localeCompare(String(b.industry)));

  return NextResponse.json(
    { ok: true, count: sites.length, sites },
    // Short cache: the cohort changes when we regenerate or retire, which is rare, but a stale
    // answer here is exactly the failure this endpoint exists to prevent.
    { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300, stale-while-revalidate=600' } },
  );
}
