// lib/outreach/restaurantApexSite.ts
//
// The RESTAURANT APEX site type — the template that fronts a <city>-restaurant.com
// claim-contest domain. Unlike every other template (a business's own site), an apex
// site is a LOCATION PORTAL QuickSites owns: an editable hero/branding shell whose
// public render appends the LIVE competition directory (winner featured first) below
// it — see the `site_type === 'restaurant_apex'` branch in app/sites/[slug].
//
// Typed via `data.meta.site_type = 'restaurant_apex'` (+ `apex_campaign_id`), with NO
// claim_source: an apex is never claimable — the contest winner gets featured on it,
// not ownership of it. Created automatically when a competition launches or a
// rent-model campaign converts (best-effort; the apex slug must be free).

import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { MENU_BASE_DOMAIN } from '@/lib/menu/deliveredMenu';

export const RESTAURANT_APEX_SITE_TYPE = 'restaurant_apex';

/** Is this template data an apex portal? (normalizer-tolerant: meta may sit on data or root) */
export function isRestaurantApexData(data: any): boolean {
  const meta = data?.meta ?? data?.data?.meta ?? {};
  return meta?.site_type === RESTAURANT_APEX_SITE_TYPE;
}

export type ApexSeedInput = {
  city: string;
  region?: string | null;
  domain: string;
  /** Apex label — MUST equal the campaign slug so the domain rewrite serves it. */
  slug: string;
  campaignId: string;
  /** delivered.menu (or the configured menu base) — the portal carries its branding.
   *  Null/'' = unbranded copy. Defaults to MENU_BASE_DOMAIN in the builder. */
  menuBrand?: string | null;
};

/**
 * Pure seed for an apex template row. A portal, not a business site: hero-only page
 * (the live directory renders below it at request time), diner-facing copy, dark mode,
 * stamped with the apex type + its campaign. No claim_source — not claimable.
 */
export function apexTemplateSeed(input: ApexSeedInput): Record<string, any> {
  const place = input.region ? `${input.city}, ${input.region}` : input.city;
  const name = `${input.city} Restaurants`;

  const tpl: any = buildIndustryStarter({ businessName: name, industryKey: 'restaurant' });

  // Portal framing: keep ONLY the hero — the menu/hours/contact blocks of a restaurant
  // starter belong to a single business, not a city directory.
  const page0 = tpl.data?.pages?.[0];
  if (page0?.blocks?.length) {
    const hero = page0.blocks.find((b: any) => b?.type === 'hero') ?? page0.blocks[0];
    if (hero?.content) {
      hero.content.headline = `Order from local restaurants in ${place}`;
      // Keep the hero copy brand-free: identical "Powered by X" boilerplate repeated in
      // the H1/H2 of every <city>-restaurant.com reads as a doorway network to search
      // engines. The delivered.menu attribution renders as a small UNLINKED footer note
      // under the directory instead (components/sites/restaurant-competition-directory).
      // ⚠️ NO CLAIM PITCH IN THE DINER'S HERO. This previously ended "Menus and online ordering
      // appear as each restaurant claims their page" — us explaining our business model in the one
      // sentence a hungry person definitely reads, and worse, telling them the thing they came for
      // mostly is not here yet. The owner who DOES care about claiming reaches this page from an
      // outreach link and needs the claim path on their own site, not in a city hero.
      // (HJ persona walkthrough, 2026-08-10: "Claim? I don't want to claim anything, I want to eat.")
      hero.content.subheadline =
        'Search tonight’s dishes across every kitchen we have. Order online where you can, call the rest direct — no delivery-app markup either way.';
      if ('cta_text' in hero.content) hero.content.cta_text = 'Browse restaurants';
      // ⚠️ THE CTA HAD TEXT BUT NO DESTINATION, so it inherited the restaurant starter's link and
      // landed on a contact form this portal does not have. `site-renderer` gives the first block
      // of each type `id=<type>`, so this is the id that actually exists on the page — not an
      // invented anchor that reads nicer and matches nothing.
      hero.content.cta_link = '#restaurants_directory';
    }
    // Hero + the directory block: the cohort renders as first-class page content
    // (editable/movable in the editor; live-hydrated by campaign_id at render time).
    const directory: any = createDefaultBlock('restaurants_directory' as any);
    directory.content = {
      ...(directory.content ?? {}),
      title: `Restaurants in ${place}`,
      campaign_id: input.campaignId,
      entries: [],
    };
    // ⚠️ THE SEARCH BOX IS THE APEX'S REASON TO EXIST, and it was only on the demo. A directory
    // answers "who is near me"; a diner usually arrives knowing what they want to EAT. Searching
    // every dish across the cohort is the thing a delivery app does that a list of links cannot,
    // and building it into the seed is why the next apex gets it without anyone remembering.
    const finder: any = createDefaultBlock('menu_finder' as any);
    finder.content = {
      ...(finder.content ?? {}),
      title: 'What are you hungry for?',
      campaign_id: input.campaignId,
    };
    page0.blocks = [hero, finder, directory];
  }

  // Portal chrome: the starter's business nav (Services/Contact) points at pages a
  // portal doesn't have — trim header/footer links to Home. The "powered by
  // delivered.menu" attribution renders inside the directory block itself.
  for (const chrome of [tpl.header_block, tpl.footer_block]) {
    if (chrome?.content && Array.isArray(chrome.content.links)) {
      chrome.content.links = [{ label: 'Home', href: '/', appearance: 'default' }];
    }
  }

  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    site_type: RESTAURANT_APEX_SITE_TYPE,
    // ⚠️ Without this the tab (and the search result) read "Home" — the builder's default page
    // name, which every site in the fleet was serving as its <title>. The headline is already the
    // honest one-line description of the page, so it is the title too.
    seo_title: `Order from local restaurants in ${place}`,
    apex_campaign_id: input.campaignId,
    apex_domain: input.domain,
    ...(input.menuBrand ? { menu_brand: input.menuBrand } : {}),
  };

  return {
    id: randomUUID(),
    template_name: name,
    slug: input.slug, // MUST equal the apex label
    data: tpl.data,
    color_mode: tpl.color_mode ?? 'dark',
    header_block: tpl.header_block,
    footer_block: tpl.footer_block,
    is_site: false,
    industry: 'restaurant',
    business_name: name,
    // No claim_source: the apex is platform-owned, never claimable.
  };
}

export type BuildApexResult = { templateId: string; slug: string; created: boolean };

/**
 * Create + publish the apex template for a restaurant competition. Idempotent-ish:
 * if ANY template already occupies the apex slug (a prior apex, or an un-parked
 * pitch site), returns it with created=false instead of colliding. Publishes via the
 * sanctioned publish RPC so the public domain serves it immediately.
 */
export async function buildRestaurantApexSite(opts: {
  campaignId: string;
  operatorId: string;
}): Promise<BuildApexResult> {
  const { data: c, error } = await supabaseAdmin
    .from('geo_industry_campaigns')
    .select('id, kind, city, region, domain, slug')
    .eq('id', opts.campaignId)
    .maybeSingle();
  if (error) throw new Error(`buildRestaurantApexSite failed: ${error.message}`);
  if (!c) throw new Error('Campaign not found.');
  if (c.kind !== 'restaurant_competition') throw new Error('Not a restaurant competition.');

  const { data: existing } = await supabaseAdmin
    .from('templates')
    .select('id, slug')
    .eq('slug', c.slug)
    .maybeSingle();
  if (existing?.id) return { templateId: existing.id, slug: c.slug, created: false };

  const row = {
    ...apexTemplateSeed({
      city: c.city,
      region: c.region,
      domain: c.domain,
      slug: c.slug,
      campaignId: c.id,
      menuBrand: MENU_BASE_DOMAIN || null, // delivered.menu branding when configured
    }),
    owner_id: opts.operatorId,
  };
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('templates')
    .insert(row)
    .select('id, slug')
    .single();
  if (insErr) throw new Error(`apex template insert failed: ${insErr.message}`);

  // Publish (snapshot + published_sites + published=true) so the apex domain serves it
  // publicly right away — an unpublished template would 404 for the public and shadow
  // the directory fallback. Best-effort: an unpublished apex is still editable/publishable
  // by the operator from the editor.
  const { error: pubErr } = await (supabaseAdmin as any).rpc('publish_template_demo', {
    p_template_id: inserted.id,
  });
  if (pubErr) {
    // Surface but don't fail creation — the operator can publish from the editor.
    console.error('[restaurant-apex] publish failed:', pubErr.message);
  }

  return { templateId: inserted.id, slug: inserted.slug, created: true };
}
