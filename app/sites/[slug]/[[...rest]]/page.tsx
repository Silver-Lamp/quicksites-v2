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
import CartPageClient from '@/components/cart/CartPageClient';
import CheckoutPageClient from '@/components/cart/CheckoutPageClient';
import ThankYouPageClient from '@/components/cart/ThankYouPageClient';
import PreviewWatermark from '@/components/sites/preview-watermark';
import MenuClaimBar from '@/components/sites/menu-claim-bar';
import CompetitionBanner from '@/components/sites/competition-banner';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import { getSiteCompetition } from '@/lib/outreach/competitionForSite';

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
): Promise<{ data: any; siteFields: any; claimSource: string | null } | null> => {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, template_name, data, header_block, footer_block, color_mode, domain, claim_source')
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
  };
});

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
  if (!siteRow) return {};

  let snapshotData: any | null = null;
  let isDraft = false;
  if (siteRow.published_snapshot_id) {
    snapshotData = await loadSnapshotDataById(siteRow.published_snapshot_id);
  } else if ((admin || menuHost) && siteRow.template_id) {
    const draft = await loadDraftTemplate(siteRow.template_id);
    snapshotData = draft?.data ?? null;
    isDraft = !!snapshotData;
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
    baseUrl: `${await originFromHeaders()}/sites`,
  });
  // An unpublished draft served on the menu surface must never be indexed.
  return isDraft ? { ...md, robots: { index: false, follow: false } } : md;
}

/* ---------------------- Page ---------------------- */
export default async function SitePreviewPage({
  params,
}: {
  // ✅ Next 15: params is async for dynamic routes
  params: Promise<{ slug: string; rest?: string[] }>;
}) {
  const { slug, rest } = await params;

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
  if (!siteRow) return notFound();

  // Prefer the published snapshot. Otherwise fall back to the live draft for admins
  // (as before) OR the public on the delivered.menu surface (so an outreach link
  // works pre-claim) — the latter renders with a "not published yet" watermark.
  let normalized: RenderSite | null = null;
  let isDraft = false;
  let claimSource: string | null = null;

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

  if (!normalized && (admin || menuHost) && siteRow.template_id) {
    const draft = await loadDraftTemplate(siteRow.template_id);
    if (draft?.data) {
      normalized = normalizeForRenderer(draft.data, draft.siteFields);
      isDraft = true;
      claimSource = draft.claimSource;
    }
  }

  if (!normalized) return notFound();

  const pageSlug = rest?.[0] ?? firstPageSlug(normalized);
  const colorMode = (normalized.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = `${await originFromHeaders()}/sites`;

  // Watermark only the public draft on the menu surface; a claimed+published site
  // (published_snapshot_id present) renders clean and indexable.
  const showWatermark = isDraft && menuHost;
  // Show the "claim your site" bar only for a still-claimable outreach draft on the
  // menu surface — mirrors the gate the claim page itself enforces.
  const showClaimBar = isDraft && menuHost && claimSource === 'listing_import';
  const claimToken = showClaimBar ? mintSiteClaimToken(siteRow.id) : null;
  const claimBusinessName =
    (normalized as any).business_name ?? (normalized as any).meta?.business_name ?? null;
  // "Who will control this domain?" — competitor race context (only when a live campaign exists).
  const competition = showClaimBar ? await getSiteCompetition(siteRow.id) : null;

  return (
    <TemplateEditorProvider
      templateName={normalized.template_name ?? normalized.slug ?? String(normalized.id)}
      colorMode={colorMode}
      initialData={normalized as any}
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
      <SiteRenderer
        site={normalized as any}
        page={pageSlug}
        baseUrl={baseUrl}
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-background text-foreground"
      />
      {showWatermark && <PreviewWatermark />}
      {showClaimBar && claimToken && (
        <MenuClaimBar templateId={siteRow.id} token={claimToken} businessName={claimBusinessName} />
      )}
    </TemplateEditorProvider>
  );
}
