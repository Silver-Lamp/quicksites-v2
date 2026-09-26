// lib/home/getShowcaseData.ts
//
// Server-side data for the homepage showcase. Used by both the public JSON feed
// (/api/public/showcase) and the homepage server component (for SSR, so the row
// renders in the initial HTML for everyone — including unauthenticated users —
// without depending on a client fetch).

import { getServerSupabase } from '@/lib/supabase/server';
import { FEATURED_SITE_SLUGS } from '@/lib/home/featured-sites';
import {
  prettifySlug,
  firstNonEmpty,
  extractHeroImage,
  isShowcaseMode,
  DEFAULT_SHOWCASE_MODE,
  SHOWCASE_MODE_KEY,
  SHOWCASE_HIDDEN_KEY,
  SHOWCASE_ORDER_KEY,
  type ShowcaseDisplayMode,
} from '@/lib/home/showcase-helpers';
import { getSiteSetting } from '@/lib/settings/siteSettings';

export type ShowcaseSite = {
  slug: string;
  name: string;
  industry: string | null;
  heroUrl: string | null;
  logoUrl: string | null;
  href: string;
  hidden: boolean;
};

export type ShowcaseData = { sites: ShowcaseSite[]; displayMode: ShowcaseDisplayMode };

// Per-instance last-good cache. The templates query intermittently fails on SSR
// (transient DB/connection blip) and would otherwise blank the row. When a query
// succeeds we stash the site list here; when a later one fails or comes back empty
// we serve the last-good sites (with the current display mode) instead of nothing.
// Serverless memory is per-instance and short-lived, so this only ever serves
// genuinely recent data — it's a blip cushion, not a real cache.
const FALLBACK_TTL_MS = 30 * 60 * 1000; // 30 min
let lastGood: { sites: ShowcaseSite[]; at: number } | null = null;

/** On a failed/empty fetch, serve recent last-good sites if we have them. */
function fallbackData(displayMode: ShowcaseDisplayMode, now: number): ShowcaseData {
  if (lastGood && now - lastGood.at < FALLBACK_TTL_MS) {
    return { sites: lastGood.sites, displayMode };
  }
  return { sites: [], displayMode };
}

/**
 * Is this a demo dressed as a customer? Checked across every name field AND the demo markers,
 * because the three that slipped through carried the word only in `template_name`.
 */
export function looksLikeDemo(r: {
  business_name?: string | null;
  template_name?: string | null;
  slug?: string | null;
  claim_source?: string | null;
  data?: any;
}): boolean {
  if (r.claim_source === 'demo_seed') return true;
  if (r.data?.meta?.is_demo === true) return true;
  const names = [r.business_name, r.template_name, r.slug].filter(Boolean).join(' ').toLowerCase();
  return /\bdemo\b/.test(names);
}

export async function getShowcaseData(): Promise<ShowcaseData> {
  const now = Date.now();
  // Fetch the three showcase settings in parallel (was 3 sequential round-trips).
  const [rawMode, hiddenList, orderList] = await Promise.all([
    getSiteSetting<string>(SHOWCASE_MODE_KEY, DEFAULT_SHOWCASE_MODE),
    getSiteSetting<string[]>(SHOWCASE_HIDDEN_KEY, []),
    getSiteSetting<string[]>(SHOWCASE_ORDER_KEY, []),
  ]);
  const displayMode = isShowcaseMode(rawMode) ? rawMode : DEFAULT_SHOWCASE_MODE;
  const hidden = new Set(Array.isArray(hiddenList) ? hiddenList : []);
  const orderIdx = new Map((Array.isArray(orderList) ? orderList : []).map((s, i) => [s, i]));

  try {
    const supa = await getServerSupabase({ serviceRole: true });
    // The showcase query intermittently failed on SSR (transient DB/connection
    // hiccup), which blanked the "Built with QuickSites" row. Retry once before
    // giving up so a single transient error doesn't drop the whole row.
    let data: any = null;
    let error: any = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await (supa as any)
        .from('templates')
        .select('slug, business_name, template_name, industry_label, industry, hero_url, logo_url, data, domain, custom_domain, owner_id, claim_source')
        .eq('is_site', true)
        .eq('published', true)
        .eq('archived', false)
        // ⚠️ LATENT TRAP, left in place deliberately (2026-07-27). `is_version` does NOT
        // reliably mean "version snapshot" — a fresh create gets is_version=true, and 50 of
        // 66 published sites currently carry it. So this filter silently drops most of the
        // fleet. It is harmless TODAY only because every curated slug in featured-sites.ts
        // happens to be is_version=false; curate one that isn't and it vanishes with no
        // error. Not changed here because the homepage is high-stakes and nothing is
        // currently broken — but app/delivered/page.tsx had the identical filter and it
        // reduced the public restaurant directory to a single placeholder. Fix both
        // together when someone has a reason to touch this query.
        .eq('is_version', false);
      data = res.data;
      error = res.error;
      if (!error && data) break;
    }
    if (error) return fallbackData(displayMode, now);

    // Defense-in-depth: never surface a guest-built site still owned by an
    // anonymous (unclaimed) user. Anon users can't publish, so this should always
    // be empty — but it guarantees abuse/junk can't leak onto the homepage.
    let anonOwned = new Set<string>();
    const guestOwnerIds = Array.from(
      new Set((data || []).filter((r: any) => r.claim_source === 'guest_build' && r.owner_id).map((r: any) => r.owner_id)),
    );
    if (guestOwnerIds.length) {
      const { data: anon } = await (supa as any).rpc('anonymous_user_ids', { p_ids: guestOwnerIds });
      anonOwned = new Set((anon || []).map((row: any) => (typeof row === 'string' ? row : row.anonymous_user_ids ?? row.id)));
    }
    const rows = (data || []).filter((r: any) => !(r.owner_id && anonOwned.has(r.owner_id)));

    const priority = new Map(FEATURED_SITE_SLUGS.map((s, i) => [s, i]));

    const sites: ShowcaseSite[] = rows
      .map((r: any) => {
        const heroUrl = firstNonEmpty(r.hero_url) || extractHeroImage(r.data);
        const industryRaw = firstNonEmpty(r.industry_label, r.industry);
        const industry = industryRaw && industryRaw.toLowerCase() !== 'generic' ? industryRaw : null;
        // ⚠️ `template_name` BEFORE the prettified slug. The owner's own featured site rendered
        // as "Pnw exteriorcleaning" on the #1 card while its real name — "PNW Prestige – Exterior
        // Cleaning" — sat one column away in `template_name`, unused. `business_name` is empty on
        // a lot of these, and title-casing a slug is a fallback for having nothing, not for
        // having the name in a field we did not look at.
        //
        // ⚠️ Skipped when `template_name` is itself slug-shaped (`new-template-66cf-y0nf`,
        // `plumbing-1`) — those are auto-generated handles, and prettifying the slug is no worse.
        const templateName = firstNonEmpty(r.template_name);
        const realName = templateName && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(templateName) ? templateName : null;
        const name = firstNonEmpty(r.business_name) || realName || (industry ? prettifySlug(r.slug) : null);
        const dom = firstNonEmpty(r.custom_domain, r.domain);
        const href = dom ? `https://${dom.replace(/^https?:\/\//, '').replace(/\/$/, '')}` : `/sites/${r.slug}`;
        const isFeatured = priority.has(r.slug);
        // ⚠️ THE HEADING OVER THIS ROW SAYS "Real businesses, live on QuickSites." Three of the
        // top nine slots were demos — "Local Legal Solutions — Demo", "EcoPest Solutions — Demo",
        // "LuxeGlow Salon & Spa — Demo" — and nobody could tell, because their `business_name` is
        // empty so the card falls back to `prettifySlug(slug)`: a visitor read "Local" and
        // "Ecopest" and had no way to know. The fallback did not strip the word on purpose; it
        // never saw it. Either way the row was making a claim about real customers that three of
        // its cards could not support.
        //
        // ⚠️ `claim_source='demo_seed'` alone does NOT catch these — all three have no claim
        // source at all, so the tag-based check that looks sufficient would have missed every one.
        // The NAME is the signal that works, and it has to be read from `template_name` too,
        // which is exactly the field the card never shows.
        const isDemo = looksLikeDemo(r);
        return {
          slug: r.slug as string,
          name: name || prettifySlug(r.slug),
          industry,
          heroUrl,
          logoUrl: firstNonEmpty(r.logo_url),
          href,
          hidden: hidden.has(r.slug),
          _publishable: !isDemo && Boolean(firstNonEmpty(r.business_name) || industry || dom || isFeatured),
        } as ShowcaseSite & { _publishable: boolean };
      })
      .filter((s: any) => s._publishable)
      .sort((a: any, b: any) => {
        const oa = orderIdx.has(a.slug) ? (orderIdx.get(a.slug) as number) : null;
        const ob = orderIdx.has(b.slug) ? (orderIdx.get(b.slug) as number) : null;
        if (oa != null && ob != null) return oa - ob;
        if (oa != null) return -1;
        if (ob != null) return 1;
        const pa = priority.has(a.slug) ? (priority.get(a.slug) as number) : Number.MAX_SAFE_INTEGER;
        const pb = priority.has(b.slug) ? (priority.get(b.slug) as number) : Number.MAX_SAFE_INTEGER;
        if (pa !== pb) return pa - pb;
        return a.name.localeCompare(b.name);
      })
      .map(({ _publishable, ...s }: any) => s);

    // A successful, non-empty fetch becomes the new last-good snapshot. An empty
    // result (e.g. query returned nothing) falls back to the previous snapshot
    // rather than blanking the row.
    if (sites.length > 0) {
      lastGood = { sites, at: now };
      return { sites, displayMode };
    }
    return fallbackData(displayMode, now);
  } catch {
    return fallbackData(displayMode, now);
  }
}
