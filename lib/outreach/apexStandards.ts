// lib/outreach/apexStandards.ts
//
// "Apex standards" — template versioning of sorts for the <city>-restaurant.com
// portals. Each apex site is individually editable (hero copy, theme, images are the
// operator's), but a small set of INVARIANTS must hold across all of them: the
// winner-first restaurants_directory block wired to the right campaign, Home-only
// portal chrome, SEO title/description defaults, and the site_type stamp. This
// transform re-asserts exactly those invariants and NOTHING else — every step fires
// only when an invariant is missing/stale, so customized apexes stay individual.
//
// Bump APEX_STANDARDS_VERSION when the standards change: the version stamp then
// differs on every apex, the Location Domains dry-run lights up "Refresh apex", and a
// refresh re-evaluates all steps + restamps.
//
// Pure: data in → { data, headerBlock, footerBlock, changed, applied }. The server
// wrapper (lib/outreach/restaurantDomains.ts#refreshApexSite) loads/commits via the
// sanctioned commit RPC and — because apexes are PUBLISHED — re-publishes after.

import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { RESTAURANT_APEX_SITE_TYPE } from '@/lib/outreach/restaurantApexSite';

/** Bump when the apex standards change — marks every apex "behind" until refreshed. */
export const APEX_STANDARDS_VERSION = 1;

/** Portal chrome: a location portal has one page — nav links to business pages are stale. */
const HOME_NAV = [{ label: 'Home', href: '/', appearance: 'default' }];

/** Old default business-site links that indicate the chrome was never customized. */
const STALE_NAV_HREFS = new Set(['/services', '/contact']);

export type ApexStandardsResult = {
  data: any;
  headerBlock: any | null;
  footerBlock: any | null;
  changed: boolean;
  /** Which standards steps fired (for the button badge / toast / audit). */
  applied: string[];
};

const clone = (v: any) => JSON.parse(JSON.stringify(v ?? null));

export function applyApexStandards(input: {
  data: any;
  headerBlock?: any | null;
  footerBlock?: any | null;
  /** The restaurant competition this apex fronts — the directory hydrates from it. */
  campaignId: string;
  /** For the SEO defaults + directory title; steps that need them skip when absent. */
  city?: string | null;
  region?: string | null;
}): ApexStandardsResult {
  const data = clone(input.data) ?? {};
  const applied: string[] = [];
  const place = [input.city, input.region].filter(Boolean).join(', ');

  const pages: any[] = Array.isArray(data?.pages) ? data.pages : [];
  const page0 = pages[0];
  const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];

  // 1) The winner-first directory block MUST exist and point at this campaign — this
  //    IS the "current winner at top, others below" guarantee (the block renders the
  //    live cohort winner-featured-first). Insert after the hero when missing.
  let directory = blocks.find((b) => b?.type === 'restaurants_directory');
  if (!directory && page0) {
    directory = createDefaultBlock('restaurants_directory' as any);
    directory.content = {
      ...(directory.content ?? {}),
      title: place ? `Restaurants in ${place}` : 'Local restaurants',
      campaign_id: input.campaignId,
      entries: Array.isArray(directory.content?.entries) ? directory.content.entries : [],
    };
    const heroIdx = blocks.findIndex((b) => b?.type === 'hero');
    blocks.splice(heroIdx >= 0 ? heroIdx + 1 : blocks.length, 0, directory);
    page0.blocks = blocks;
    if (Array.isArray(page0.content_blocks)) page0.content_blocks = blocks; // legacy readers
    applied.push('directory_block');
  } else if (directory) {
    // 2) Block exists but hydrates the wrong (or no) campaign → repoint it.
    directory.content = directory.content ?? {};
    if (String(directory.content.campaign_id ?? '') !== input.campaignId) {
      directory.content.campaign_id = input.campaignId;
      applied.push('directory_campaign_id');
    }
  }

  // 3) Portal chrome: header/footer nav → Home-only, but ONLY when they still carry
  //    the stale business-site page links (/services, /contact) — a customized nav is
  //    the operator's and stays untouched.
  const headerBlock = clone(input.headerBlock ?? data?.headerBlock ?? null);
  const footerBlock = clone(input.footerBlock ?? data?.footerBlock ?? null);
  const trimStaleNav = (chrome: any): boolean => {
    if (!chrome?.content) return false;
    let hit = false;
    for (const key of ['nav_items', 'links']) {
      const arr = chrome.content[key];
      if (Array.isArray(arr) && arr.some((l) => STALE_NAV_HREFS.has(String(l?.href ?? '')))) {
        chrome.content[key] = HOME_NAV.map((l) => ({ ...l }));
        hit = true;
      }
    }
    return hit;
  };
  if (trimStaleNav(headerBlock)) applied.push('header_portal_nav');
  if (trimStaleNav(footerBlock)) applied.push('footer_portal_nav');

  // 4) Type stamp: converted pitch sites predating the apex type get typed here so the
  //    public render + admin surfaces recognize them.
  data.meta = data.meta ?? {};
  const meta = data.meta;
  {
    let stamped = false;
    if (meta.site_type !== RESTAURANT_APEX_SITE_TYPE) {
      meta.site_type = RESTAURANT_APEX_SITE_TYPE;
      stamped = true;
    }
    if (!meta.apex_campaign_id) {
      meta.apex_campaign_id = input.campaignId;
      stamped = true;
    }
    if (stamped) applied.push('site_type_stamp');
  }

  // 5) SEO defaults — ONLY when empty (the same diner-facing copy the metadata
  //    fallback in app/sites/[slug] serves). An operator-written title/description wins.
  if (place) {
    let seo = false;
    if (!String(meta.title ?? '').trim()) {
      meta.title = `Order from restaurants in ${place}`;
      seo = true;
    }
    if (!String(meta.description ?? '').trim()) {
      meta.description = `Browse and order online from local restaurants in ${place}.`;
      seo = true;
    }
    if (seo) applied.push('seo_meta');
  }

  // 6) Version stamp — always last. Restamping on ANY version drift means bumping the
  //    const lights up every apex's refresh button, and a refresh converges even when
  //    every other step no-ops.
  if (meta.apex_standards_version !== APEX_STANDARDS_VERSION) {
    meta.apex_standards_version = APEX_STANDARDS_VERSION;
    applied.push('standards_version');
  }

  // Keep the data-bag copies in sync when chrome changed.
  if (applied.includes('header_portal_nav')) data.headerBlock = headerBlock;
  if (applied.includes('footer_portal_nav')) data.footerBlock = footerBlock;

  return { data, headerBlock, footerBlock, changed: applied.length > 0, applied };
}
