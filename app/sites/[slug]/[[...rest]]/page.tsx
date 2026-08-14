// app/sites/[slug]/[[...rest]]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import SiteRenderer from '@/components/sites/site-renderer';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { loadCityMenuFeed, menuFinderCampaignId } from '@/lib/menu/cityMenuIndexServer';
import {
  PUBLIC_PATH_HEADER,
  absoluteUrl,
  publicPathFor,
  stripHomeSegment,
} from '@/lib/seo/canonicalUrl';
import { buildLocalBusinessSchema, localBusinessSchemaEnabled } from '@/lib/seo/localBusinessSchema';
import { buildPersonSchema, personIdentityFromTemplate, personSchemaEnabled } from '@/lib/seo/personSchema';
import CartPageClient from '@/components/cart/CartPageClient';
import CheckoutPageClient from '@/components/cart/CheckoutPageClient';
import ThankYouPageClient from '@/components/cart/ThankYouPageClient';
import PreviewWatermark from '@/components/sites/preview-watermark';
import MenuClaimBar from '@/components/sites/menu-claim-bar';
import DemandCapture from '@/components/sites/demand-capture';
import CompetitionBanner from '@/components/sites/competition-banner';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import AdminEditPill from '@/components/sites/admin-edit-pill';
import OwnerThemeTools from '@/components/sites/owner-theme-tools';
import { getSiteCompetition } from '@/lib/outreach/competitionForSite';
import { MENU_DEMAND_CAPTURE_ENABLED, MENU_DRAFT_INDEXABLE } from '@/lib/flags/menuDemand';
import { getDemandCount } from '@/lib/menu/demand';
import { needsMenu } from '@/lib/outreach/candidates';
import { resolveListingPhone } from '@/lib/claim/resolveListingPhone';
import { loadCompetitionDirectoryBySlug } from '@/lib/outreach/restaurantCompetitionDirectory';
import RestaurantCompetitionDirectory from '@/components/sites/restaurant-competition-directory';
import { loadAutoShopDirectoryBySlug } from '@/lib/outreach/autoShopCompetitionDirectory';
import AutoShopCompetitionDirectory from '@/components/sites/auto-shop-competition-directory';
import { isRestaurantApexData } from '@/lib/outreach/restaurantApexSite';

/* -------------------- Types -------------------- */
type SiteRow = {
  id: string;
  slug: string | null;
  domain: string | null;
  template_id: string | null;
  published_snapshot_id: string | null;
};

type RenderSite = {
  id: string;
  slug: string | null;
  template_name: string | null;
  domain: string | null;
  default_subdomain?: string | null;
  color_mode: 'light' | 'dark';
  pages: any[];
  headerBlock: any | null;
  footerBlock: any | null;
  data: any;
};

/* -------------------- Helpers -------------------- */
// NOTE: headers() is sync; no need to await. Keep this function sync.
async function originFromHeaders() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .toLowerCase()
    .replace(/\.$/, '');
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

/**
 * The absolute URL the visitor is actually on.
 *
 * ⚠️ NOT `origin + '/sites/' + slug`. Every tenant host reaches this page through a rewrite, so
 * the routed path is our routing table, not their address. See lib/seo/canonicalUrl.ts.
 */
async function publicUrlFromHeaders(slug: string, rest?: string[] | null): Promise<string> {
  const h = await headers();
  return absoluteUrl(
    await originFromHeaders(),
    publicPathFor({ headerPath: h.get(PUBLIC_PATH_HEADER), slug, rest: stripHomeSegment(rest) }),
  );
}

/**
 * True when this request arrived via the delivered.menu surface (set by middleware).
 * On that host we serve an unclaimed draft to the public — watermarked + noindex —
 * so an outreach link works before the restaurant claims it. Every other host keeps
 * the published-only behavior (draft render stays admin-gated).
 */
async function isMenuHostRequest() {
  const h = await headers();
  return h.get('x-qsites-menu-host') === '1';
}

function firstPageSlug(site: { data?: any; pages?: any[] }) {
  const pages = Array.isArray((site as any)?.pages)
    ? (site as any).pages
    : ((site as any)?.data?.pages ?? []);
  const first = Array.isArray(pages) ? pages.find((p: any) => p?.slug) ?? pages[0] : null;
  return (first?.slug as string) || 'home';
}

function normalizeForRenderer(
  snapshotData: any,
  siteFields: Pick<SiteRow, 'id' | 'slug' | 'domain'> & { default_subdomain?: string | null }
): RenderSite {
  const data = snapshotData ?? {};
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const headerBlock = data?.headerBlock ?? data?.header ?? null;
  const footerBlock = data?.footerBlock ?? data?.footer ?? null;
  const color_mode = (data?.meta?.theme === 'dark' ? 'dark' : data?.color_mode) ?? 'light';
  const template_name = data?.meta?.siteTitle ?? siteFields.slug ?? null;

  return {
    id: siteFields.id,
    slug: siteFields.slug,
    template_name,
    domain: siteFields.domain,
    default_subdomain: siteFields.default_subdomain ?? null,
    color_mode,
    pages,
    headerBlock,
    footerBlock,
    data,
  };
}

function safeParse(x: any) {
  if (typeof x !== 'string') return x ?? {};
  try {
    return JSON.parse(x);
  } catch {
    return {};
  }
}

/* ----------------- Data access (new + compat) ------------------ */

/** Old path: look up in `public.sites` */
async function loadSiteRowBySlug(slug: string): Promise<SiteRow | null> {
  const { data, error } = await supabaseAdmin
    .from('sites')
    .select('id, slug, domain, template_id, published_snapshot_id')
    .eq('slug', slug)
    .maybeSingle();
  if (error) {
    console.warn('[sites] lookup by slug failed:', error.message);
    return null;
  }
  return (data as SiteRow) ?? null;
}

/**
 * New path: templates + published_sites/template_versions.
 * Wrapped in React cache() so generateMetadata + the page render resolve the
 * slug once per request instead of running this ~4-query chain twice.
 */
const loadSiteRowBySlugOrTemplate = cache(async (slug: string): Promise<SiteRow | null> => {
  // 1) legacy sites table
  const legacy = await loadSiteRowBySlug(slug);
  if (legacy) return legacy;

  // 2) template by slug
  const tpl = await supabaseAdmin
    .from('templates')
    .select('id, slug, data, domain')
    .eq('slug', slug)
    .maybeSingle();

  if (tpl.error || !tpl.data) return null;

  const tplId: string = (tpl.data as any).id;
  const tplDomain: string | null =
    (tpl.data as any).domain ?? (safeParse((tpl.data as any).data)?.meta?.domain ?? null);

  // collect version ids for this template
  const vers = await supabaseAdmin
    .from('template_versions')
    .select('id, created_at')
    .eq('template_id', tplId);

  const versionIds: string[] = Array.isArray(vers.data) ? vers.data.map((v: any) => v.id) : [];

  // find most recent published_sites row that points to one of those versions
  let published_snapshot_id: string | null = null;
  if (versionIds.length) {
    const pubs = await supabaseAdmin
      .from('published_sites')
      .select('snapshot_id, published_at')
      .in('snapshot_id', versionIds)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!pubs.error && pubs.data) {
      published_snapshot_id = (pubs.data as any).snapshot_id ?? null;
    }
  }

  return {
    id: tplId,
    slug: (tpl.data as any).slug ?? slug,
    domain: tplDomain,
    template_id: tplId,
    published_snapshot_id,
  };
});

/**
 * Read snapshot content by id: first try `snapshots.data` (legacy), else
 * `template_versions.full_data`.
 *
 * A published snapshot is IMMUTABLE by id — a republish mints a brand-new
 * snapshot id and flips siteRow.published_snapshot_id (read fresh each request),
 * so this content can be cached across requests with no publish-path
 * revalidation wiring. The inner fn throws on a miss/error so unstable_cache
 * never persists a transient failure or a not-found.
 */
const loadSnapshotContentCached = unstable_cache(
  async (id: string): Promise<any> => {
    const snap = await supabaseAdmin
      .from('snapshots')
      .select('data')
      .eq('id', id)
      .maybeSingle();
    if (!snap.error && snap.data && (snap.data as any).data != null) return (snap.data as any).data;

    const ver = await supabaseAdmin
      .from('template_versions')
      .select('full_data')
      .eq('id', id)
      .maybeSingle();
    if (!ver.error && ver.data && (ver.data as any).full_data != null) return (ver.data as any).full_data;

    // Not found (or a transient read error) — throw so nothing is cached.
    throw new Error(`snapshot-content-not-found:${id}`);
  },
  ['site-snapshot-content-v1'],
  { revalidate: 3600 },
);

async function loadSnapshotDataById(id: string): Promise<any | null> {
  try {
    return await loadSnapshotContentCached(id);
  } catch {
    return null;
  }
}

/**
 * For draft fallback when an admin (or the menu host) views an unpublished site.
 * React cache() only — drafts mutate, so this must stay per-request (never cached
 * across requests), but generateMetadata + the page still share one read.
 */
const loadDraftTemplate = cache(async (
  templateId: string,
): Promise<{
  data: any;
  siteFields: any;
  claimSource: string | null;
  ownerId: string | null;
  industry: string | null;
  businessName: string | null;
} | null> => {
  const { data, error } = await supabaseAdmin
    .from('templates')
    // ⚠️ industry + business_name ARE LOAD-BEARING, not metadata. Without them the renderer treats
    // every draft as a restaurant (needsMenu(null) defaults to food) and the claim bar loses the
    // business's name — which is how an auto shop's page asked "Is this your restaurant?" and
    // offered to take online orders, twice, after a fix that read fields nobody populated.
    .select('id, slug, template_name, data, header_block, footer_block, color_mode, domain, claim_source, owner_id, industry, business_name')
    .eq('id', templateId)
    .maybeSingle();
  if (error) {
    console.warn('[templates] draft meta lookup failed:', error.message);
    return null;
  }
  const d = safeParse(data?.data) ?? {};
  if (data?.header_block && !d?.headerBlock) d.headerBlock = data.header_block;
  if (data?.footer_block && !d?.footerBlock) d.footerBlock = data.footer_block;
  if (data?.color_mode && !d?.color_mode) d.color_mode = data.color_mode;

  return {
    data: d,
    siteFields: {
      id: data!.id,
      slug: data!.slug,
      domain: (data as any).domain ?? d?.meta?.domain ?? null,
      default_subdomain: null,
    },
    claimSource: (data as any)?.claim_source ?? null,
    ownerId: (data as any)?.owner_id ?? null,
    industry: (data as any)?.industry ?? null,
    businessName: (data as any)?.business_name ?? null,
  };
});

/**
 * May this unclaimed draft be shown to the public on ANY host?
 *
 * ⚠️ THIS USED TO BE "IS IT THE MENU HOST?", AND THAT COUPLING BROKE A DOMAIN WE HAD JUST BOUGHT.
 * Serving a pre-claim draft is a property of the DRAFT — operator-built, from a public listing,
 * nobody owns it yet — not a property of delivered.menu. It was written as a host check because
 * restaurants were the only vertical, and the moment auto shops arrived every "Visit shop →" link
 * on paterson-auto-repair.com 404'd: the directory points at <slug>.quicksites.ai, and the platform
 * host refused to render an unpublished draft.
 *
 * ⚠️ DELIBERATELY NARROW. Only operator-built listing drafts with NO owner. A guest_build draft is
 * somebody's private work-in-progress and must stay invisible until they publish it.
 */
function isPublicPreClaimDraft(claimSource: string | null, ownerId: string | null): boolean {
  if (ownerId) return false;
  return claimSource === 'listing_import' || claimSource === 'operator_draft';
}

/** Current request user (auth cookie), memoized per request. */
const getCurrentUser = cache(async () => {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
});

const isAdminUser = cache(async (userId: string | null) => {
  if (!userId) return false;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
});

/* -------------------- Metadata -------------------- */
export async function generateMetadata({
  params,
}: {
  // ✅ Next 15: params is async for dynamic routes
  params: Promise<{ slug: string; rest?: string[] }>;
}): Promise<Metadata> {
  const { slug, rest } = await params;

  // Special pages (client-rendered)
  if (rest?.[0] === 'cart') return { title: 'Cart' };
  if (rest?.[0] === 'checkout') return { title: 'Checkout' };
  if (rest?.[0] === 'thank-you') return { title: 'Thank you' };

  const user = await getCurrentUser();
  const admin = await isAdminUser(user?.id ?? null);

  const menuHost = await isMenuHostRequest();
  const siteRow = await loadSiteRowBySlugOrTemplate(slug);
  if (!siteRow) {
    // No site at this slug — it may be a restaurant domain-competition apex directory.
    const dir = await loadCompetitionDirectoryBySlug(slug);
    if (dir) {
      const place = [dir.city, dir.region].filter(Boolean).join(', ');
      return {
        title: place ? `Order from restaurants in ${place}` : 'Order from local restaurants',
        description: `Browse and order online from local restaurants${place ? ` in ${place}` : ''}.`,
        // Index as soon as the directory has real content (2+ restaurants) — the apex
        // must START ranking for "<city> restaurant" BEFORE outreach so "first to claim
        // gets a ranking domain" is a real prize (rank takes months; see ranked
        // targeting). Only a genuinely thin directory (0–1 entries) stays noindex.
        ...(dir.entries.length >= 2 ? {} : { robots: { index: false, follow: false } }),
      };
    }
    // Or an auto-shop domain-competition apex (<city>-auto-repair.com).
    const autoDir = await loadAutoShopDirectoryBySlug(slug);
    if (autoDir) {
      const place = [autoDir.city, autoDir.region].filter(Boolean).join(', ');
      return {
        title: place ? `Trusted auto shops in ${place}` : 'Trusted local auto shops',
        description: `Find an auto repair shop that shows you the work${place ? ` in ${place}` : ''} — see the problem and approve before the repair.`,
        ...(autoDir.entries.length >= 2 ? {} : { robots: { index: false, follow: false } }),
      };
    }
    return {};
  }

  let snapshotData: any | null = null;
  let isDraft = false;
  let claimSource: string | null = null;
  if (siteRow.published_snapshot_id) {
    snapshotData = await loadSnapshotDataById(siteRow.published_snapshot_id);
  } else if ((admin || menuHost) && siteRow.template_id) {
    const draft = await loadDraftTemplate(siteRow.template_id);
    snapshotData = draft?.data ?? null;
    isDraft = !!snapshotData;
    claimSource = draft?.claimSource ?? null;
  }
  if (!snapshotData) return {};

  const normalized = normalizeForRenderer(snapshotData, {
    id: siteRow.id,
    slug: siteRow.slug,
    domain: siteRow.domain,
    default_subdomain: null,
  });

  const pageSlug = rest?.[0] ?? firstPageSlug(normalized);
  const md = generatePageMetadata({
    site: normalized as any,
    pageSlug,
    // The page's own public URL — `generatePageMetadata` appends nothing when the base already
    // resolves the page, so pass it whole rather than a base to be joined with a page slug.
    baseUrl: await publicUrlFromHeaders(siteRow.slug ?? slug, rest),
    canonicalIsExact: true,
  });
  // A restaurant-apex portal indexes as soon as its directory has real content (2+
  // restaurants) — it must start ranking BEFORE outreach so the "ranking domain" prize
  // is real. Only a thin 0–1-entry directory stays noindex (same rule as the fallback).
  if (isRestaurantApexData(normalized)) {
    const dir = await loadCompetitionDirectoryBySlug(siteRow.slug ?? slug);
    if (dir && dir.entries.length < 2) return { ...md, robots: { index: false, follow: false } };
  }
  // A no-website `listing_import` draft on the menu surface IS the restaurant's web
  // presence — index it (flag-gated) so it ranks for their name and can actually feed
  // the demand signal. Admin previews + every other draft stay noindex.
  const indexableDraft = isDraft && menuHost && claimSource === 'listing_import' && MENU_DRAFT_INDEXABLE;
  if (isDraft && !indexableDraft) return { ...md, robots: { index: false, follow: false } };

  // ⚠️ PUBLISHED IS NOT THE SAME AS READY TO BE FOUND. A custom site under client review is
  // published so the client can open it on a phone from an email — that is the only way to show
  // her the real thing — but it is one of several options, most of which will be deleted, and its
  // copy is still being argued about. A discarded draft of a REAL NAMED PERSON'S business sitting
  // in a search index, competing with the one they chose, is a liability nobody asked us to create.
  // `meta.noindex` lets a site be publicly reachable without being publicly discoverable.
  const meta = (normalized as any)?.meta ?? (normalized as any)?.data?.meta;
  if (meta?.noindex === true) return { ...md, robots: { index: false, follow: false } };

  return md;
}

/* ---------------------- Page ---------------------- */
export default async function SitePreviewPage({
  params,
  searchParams,
}: {
  // ✅ Next 15: params is async for dynamic routes
  params: Promise<{ slug: string; rest?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug, rest } = await params;
  const sp = (await searchParams) ?? {};

  // Special routes served directly
  if (Array.isArray(rest)) {
    if (rest[0] === 'cart') return <CartPageClient />;
    if (rest[0] === 'checkout') return <CheckoutPageClient />;
    if (rest[0] === 'thank-you') return <ThankYouPageClient />;
  }

  const user = await getCurrentUser();
  const admin = await isAdminUser(user?.id ?? null);
  const menuHost = await isMenuHostRequest();

  const siteRow = await loadSiteRowBySlugOrTemplate(slug);
  if (!siteRow) {
    // No site at this slug — render a domain-competition directory if this apex fronts one
    // (<city>-restaurant.com or <city>-auto-repair.com); otherwise 404.
    const dir = await loadCompetitionDirectoryBySlug(slug);
    if (dir) return <RestaurantCompetitionDirectory dir={dir} />;
    const autoDir = await loadAutoShopDirectoryBySlug(slug);
    if (autoDir) return <AutoShopCompetitionDirectory dir={autoDir} />;
    // On delivered.menu the visitor is looking for dinner, not for us — they get the restaurant
    // directory rather than the site-builder sitemap. That branch now lives in
    // app/sites/not-found.tsx, because RETURNING a component is a 200: every missing restaurant
    // used to answer HTTP 200 with a body reading "NOT FOUND". notFound() sends a real 404 and
    // still renders the diner-facing page.
    return notFound();
  }

  // Prefer the published snapshot. Otherwise fall back to the live draft for admins
  // (as before) OR the public on the delivered.menu surface (so an outreach link
  // works pre-claim) — the latter renders with a "not published yet" watermark.
  let normalized: RenderSite | null = null;
  let isDraft = false;
  let claimSource: string | null = null;
  // Carried off the template row — `normalized`/`siteRow` do not have them on the draft path.
  let draftIndustry: string | null = null;
  let draftBusinessName: string | null = null;

  if (siteRow.published_snapshot_id) {
    const snapData = await loadSnapshotDataById(siteRow.published_snapshot_id);
    if (snapData) {
      normalized = normalizeForRenderer(snapData, {
        id: siteRow.id,
        slug: siteRow.slug,
        domain: siteRow.domain,
        default_subdomain: null,
      });
    }
  }

  if (!normalized && siteRow.template_id) {
    const draft = await loadDraftTemplate(siteRow.template_id);
    // Admins and the menu host see any draft; everyone else only an unclaimed operator draft.
    const mayShow =
      admin || menuHost || (draft ? isPublicPreClaimDraft(draft.claimSource, draft.ownerId) : false);
    if (draft?.data && mayShow) {
      normalized = normalizeForRenderer(draft.data, draft.siteFields);
      isDraft = true;
      claimSource = draft.claimSource;
      draftIndustry = draft.industry;
      draftBusinessName = draft.businessName;
    }
  }

  if (!normalized) return notFound();

  const pageSlug = rest?.[0] ?? firstPageSlug(normalized);
  const colorMode = (normalized.color_mode ?? 'light') as 'light' | 'dark';
  // Absolute public URL of THIS page — used as the `url` in the JSON-LD blocks below, which is an
  // address a search engine will follow. It must be the visitor's URL, not our rewrite target.
  const pageUrl = await publicUrlFromHeaders(siteRow.slug ?? slug, rest);
  const baseUrl = `${await originFromHeaders()}/sites`;

  // Watermark only the public draft on the menu surface; a claimed+published site
  // (published_snapshot_id present) renders clean and indexable.
  // ⚠️ Follows the DRAFT, not the host. An unclaimed draft on quicksites.ai is exactly as
  // unclaimed as one on delivered.menu, and an unwatermarked one reads as a finished site.
  const showWatermark = isDraft;
  // Show the "claim your site" bar only for a still-claimable outreach draft on the
  // menu surface — mirrors the gate the claim page itself enforces.
  const showClaimBar = isDraft && (claimSource === 'listing_import' || claimSource === 'operator_draft');
  const claimToken = showClaimBar ? mintSiteClaimToken(siteRow.id) : null;
  const claimBusinessName =
    draftBusinessName ??
    (normalized as any).business_name ??
    (normalized as any).meta?.business_name ??
    null;
  // "Who will control this domain?" — competitor race context (only when a live campaign exists).
  const competition = showClaimBar ? await getSiteCompetition(siteRow.id) : null;

  // Demand capture: on a claimable draft (flag-gated), count the order-intents we've logged
  // and resolve the listing phone for the "call to order" fallback. Drives the claim pitch.
  // ⚠️ THE ORDER-AHEAD CHROME IS FOOD-ONLY, AND IT USED TO BE HOST-ONLY.
  // `showClaimBar` gates on the menu HOST plus claim_source, which was a fine proxy while every
  // listing-import draft was a restaurant. It stopped being one the moment auto shops were built:
  // a mechanic's page rendered a "🍽 Order online?" pill and a claim bar reading "Is this your
  // restaurant?" over correct auto-repair copy. An owner sees that in the first second.
  const siteIndustry =
    draftIndustry ?? (normalized as any).industry ?? (siteRow as any)?.industry ?? null;
  const isFoodSite = needsMenu(siteIndustry);
  const demandEnabled = showClaimBar && isFoodSite && MENU_DEMAND_CAPTURE_ENABLED;
  const demandCount = demandEnabled ? await getDemandCount(siteRow.id) : 0;
  const demandPhone = demandEnabled
    ? resolveListingPhone({ data: (normalized as any).data })
    : null;

  // Restaurant-apex portal (site_type='restaurant_apex'): the LIVE competition
  // directory renders below the template — but only for LEGACY apex templates that
  // don't carry the restaurants_directory block yet (new apexes render the cohort as
  // first-class page content; appending here would double it). Home page only.
  const hasDirectoryBlock = (normalized.pages ?? []).some((p: any) =>
    (p?.blocks ?? []).some((b: any) => b?.type === 'restaurants_directory'),
  );
  const apexDirectory =
    isRestaurantApexData(normalized) && !rest?.length && !hasDirectoryBlock
      ? await loadCompetitionDirectoryBySlug(siteRow.slug ?? slug)
      : null;

  // ⚠️ THE CITY DISH INDEX, FETCHED HERE SO IT IS IN THE SERVED HTML. `menu_finder` fetched its
  // own feed in an effect, so the search box and every dish name were absent from the bytes —
  // invisible to a crawler and to a no-JS first paint, on the page whose entire product is that
  // search. The block still refetches after hydration, so nothing here goes stale; this decides
  // only what the first render contains. Null on any failure: the page must never 500 because a
  // decoration could not load.
  const menuFinderCampaign = menuFinderCampaignId(normalized.data);
  const cityMenuFeed = menuFinderCampaign ? await loadCityMenuFeed(menuFinderCampaign) : null;

  // LocalBusiness JSON-LD (built live from identity so it stays fresh) — emitted when the
  // operator turned it on in the Readiness coach. Skipped on the pre-claim watermarked draft.
  const localBusinessSchema =
    !showWatermark && localBusinessSchemaEnabled(normalized.data)
      ? buildLocalBusinessSchema(normalized.data, { url: pageUrl })
      : null;

  // Person JSON-LD for portfolio / résumé sites — the `sameAs` block that tells a search engine
  // this page and the owner's other profiles are one human. Same watermark rule as LocalBusiness:
  // an unclaimed draft asserts nothing about anyone.
  // ⚠️ No `!`. `personIdentityFromTemplate` returns null when the site has no name to assert,
  // and a non-null assertion there is a TypeError on the PUBLIC render — a published page 500ing
  // because its owner had not filled in a field. The absent case is the normal one, not the
  // impossible one.
  const personIdentity =
    !showWatermark &&
    personSchemaEnabled(normalized.data, siteIndustry)
      ? personIdentityFromTemplate(normalized.data, { url: pageUrl })
      : null;
  const personSchema = personIdentity ? buildPersonSchema(personIdentity) : null;

  return (
    <TemplateEditorProvider
      templateName={normalized.template_name ?? normalized.slug ?? String(normalized.id)}
      colorMode={colorMode}
      initialData={normalized as any}
      // This is a visitor's browser: no session, nothing to reconcile. See the prop's comment —
      // without it every page view of every published site fires an authenticated fetch that can
      // only 401.
      readOnly
    >
      {competition && claimToken && (
        <CompetitionBanner
          domain={competition.domain}
          city={competition.city}
          industryLabel={competition.industryLabel}
          competitors={competition.competitors}
          deadlineIso={competition.deadlineIso}
          claimHref={`/claim-site/${siteRow.id}?token=${encodeURIComponent(claimToken)}`}
        />
      )}
      {localBusinessSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      )}
      {personSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }}
        />
      )}
      <SiteRenderer
        site={normalized as any}
        page={pageSlug}
        baseUrl={baseUrl}
        id="site-renderer-page"
        colorMode={colorMode}
        // ⚠️ DO NOT PAINT THE SURFACE HERE. This duplicated what SiteRenderer already applied
        // (the served markup read `bg-background text-foreground bg-background text-foreground`),
        // and an opaque fill on this element sits above the theme wrapper's backdrop layers and
        // hides them. The wrapper owns the surface now; removing the class here is what makes the
        // site's backdrop actually reach a pixel. A second opaque paint is how it stayed hidden
        // even after the renderer stopped painting one.
        serverData={cityMenuFeed ? { menu_finder: cityMenuFeed } : undefined}
      />
      {apexDirectory && <RestaurantCompetitionDirectory dir={apexDirectory} compact />}
      {showWatermark && <PreviewWatermark hideCornerBadge={showClaimBar} />}
      {demandEnabled && <DemandCapture templateId={siteRow.id} phone={demandPhone} />}
      {showClaimBar && claimToken && (
        <MenuClaimBar
          templateId={siteRow.id}
          token={claimToken}
          businessName={claimBusinessName}
          demandCount={demandCount}
          isFood={isFoodSite}
        />
      )}
      {/* Operator jump-to-editor. `admin` only ever fires on the canonical host (auth
          cookies are host-only), so ?edit=1 is the universal trigger everywhere else. */}
      <AdminEditPill
        slug={slug}
        host={siteRow.domain ?? null}
        admin={admin}
        editParam={sp.edit === '1' || sp.edit === 'true'}
      />
      {/* Owner-only theme controls on the wordmark. Same two triggers as the pill above and for
          the same reason — a session on the canonical host is not sent to this one, so `admin`
          is the automatic case and ?edit=1 is the universal one. A visitor gets neither, and the
          component renders nothing at all without one. */}
      <OwnerThemeTools
        slug={slug}
        host={siteRow.domain ?? null}
        enabled={admin || sp.edit === '1' || sp.edit === 'true'}
      />
    </TemplateEditorProvider>
  );
}
