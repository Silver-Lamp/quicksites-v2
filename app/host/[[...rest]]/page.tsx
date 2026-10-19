// app/admin/templates/host/[[...rest]]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { notFound, redirect, permanentRedirect } from 'next/navigation';
import { resolvePublicPath } from '@/lib/sites/redirects';
import type { Metadata } from 'next';
import type React from 'react';
import { headers } from 'next/headers';
import Script from 'next/script';

import SiteRenderer from '@/components/sites/site-renderer';
import SiteThemeSetter from '@/components/sites/site-theme-setter';
import { siteLocale } from '@/lib/sites/siteLocale';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { cookies } from 'next/headers';
import AbBeacon from '@/components/home/ab-beacon';
import { AB_PREVIEW_MARK, applySiteVariantB, forcedVariant, pickSiteVariant, previewPathVariant, siteAbCookie, siteExperimentId } from '@/lib/ab/siteAb';
import { getSiteAb } from '@/lib/ab/siteAbDb';
import { platformSiteRoots, siteSlugFromHost, tenantRoot, tenantSiteHosts } from '@/lib/sites/tenantRoot';

const QS_DEBUG = process.env.QSITES_DEBUG === '1';
const BASE_DOMAIN = tenantRoot();

function qlog(msg: string, extra?: any) {
  if (!QS_DEBUG) return;
  try {
    const scrub = (v: any) =>
      typeof v === 'string' && v.length > 16 ? v.slice(0, 6) + '…' + v.slice(-4) : v;
    const safe = extra && JSON.parse(JSON.stringify(extra, (_k, v) => scrub(v)));
    // eslint-disable-next-line no-console
    console.log(`[QSITES] ${msg}`, safe ?? '');
  } catch {
    // eslint-disable-next-line no-console
    console.log(`[QSITES] ${msg}`);
  }
}

/* ---------- types ---------- */
type SiteRow = {
  id: string;
  slug: string | null;
  domain: string | null;
  default_subdomain: string | null;
  template_id: string | null;
  published_snapshot_id: string | null;
};

type SnapshotRow = {
  id: string;
  template_id: string;
  rev: number;
  data: Record<string, any>;
  hash?: string | null;
  assets_resolved: Record<string, any>;
  created_at?: string | null;
};

type RenderSite = {
  id: string;
  slug: string | null;
  template_name: string | null;
  domain: string | null;
  default_subdomain: string | null;
  color_mode: 'light' | 'dark';
  pages: any[];
  headerBlock: any | null;
  footerBlock: any | null;
  data: any; // original snapshot data (for downstream)
};

/* ---------- helpers ---------- */
async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .toLowerCase()
    .replace(/\.$/, '');
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function firstPageSlug(site: { data?: any; pages?: any[] }): string {
  const pages = Array.isArray((site as any)?.pages)
    ? (site as any).pages
    : ((site as any)?.data?.pages ?? []);
  const first = Array.isArray(pages) ? pages.find((p: any) => p?.slug) ?? pages[0] : null;
  return (first?.slug as string) || 'home';
}

function normalizeForRenderer(snapshotData: any, siteFields: Pick<SiteRow, 'id'|'slug'|'domain'|'default_subdomain'>): RenderSite {
  const data = snapshotData ?? {};
  const pages = Array.isArray(data?.pages) ? data.pages : [];
  const headerBlock = data?.headerBlock ?? data?.header ?? null;
  const footerBlock = data?.footerBlock ?? data?.footer ?? null;
  const color_mode = (data?.meta?.theme === 'dark' ? 'dark' : data?.color_mode) ?? 'light';

  return {
    id: siteFields.id,
    slug: siteFields.slug,
    template_name: data?.meta?.siteTitle ?? siteFields.slug ?? null,
    domain: siteFields.domain,
    default_subdomain: siteFields.default_subdomain,
    color_mode,
    pages,
    headerBlock,
    footerBlock,
    data,
  };
}

function safeParse(x: any) {
  if (typeof x !== 'string') return x;
  try { return JSON.parse(x); } catch { return {}; }
}

async function loadSnapshotById(id: string): Promise<SnapshotRow | null> {
  const { data, error } = await supabaseAdmin
    .from('snapshots')
    .select('id, template_id, data, hash, created_at')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    qlog('snapshots lookup error', error?.message || error);
    return null;
  }
  return (data as SnapshotRow) ?? null;
}

async function loadDraftTemplate(templateId: string): Promise<{ data: any; siteFields: any } | null> {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('id, template_name, slug, data, header_block, footer_block, color_mode, domain, default_subdomain')
    .eq('id', templateId)
    .maybeSingle();
  if (error) {
    qlog('templates draft lookup error', error?.message || error);
    return null;
  }
  const d = safeParse(data?.data) ?? {};
  if (data?.header_block && !d?.headerBlock) d.headerBlock = data.header_block;
  if (data?.footer_block && !d?.footerBlock) d.footerBlock = data.footer_block;
  if (data?.color_mode && !d?.color_mode) d.color_mode = data.color_mode;

  return { data: d, siteFields: { id: data!.id, slug: data!.slug, domain: data!.domain, default_subdomain: data!.default_subdomain } };
}

async function findSiteByHost(hostNoPort: string): Promise<SiteRow | null> {
  const variants = hostNoPort.startsWith('www.')
    ? [hostNoPort, hostNoPort.slice(4)]
    : [hostNoPort, `www.${hostNoPort}`];

  // 1) Direct domain
  const { data: site, error } = await supabaseAdmin
    .from('sites')
    .select('id, slug, domain, default_subdomain, template_id, published_snapshot_id')
    .in('domain', variants)
    .maybeSingle();

  if (site) return site as SiteRow;

  // 2) a platform subdomain — on the tenant root, or on the brand root while rows still name it
  const platformSub = siteSlugFromHost(hostNoPort.replace(/^www\./, ''), platformSiteRoots());
  if (platformSub) {
    const sub = platformSub;
    // default_subdomain exact match (legacy rows were written as `<sub>.<brand root>`)
    const { data: byDefault } = await supabaseAdmin
      .from('sites')
      .select('id, slug, domain, default_subdomain, template_id, published_snapshot_id')
      .in('default_subdomain', tenantSiteHosts(sub))
      .limit(1)
      .maybeSingle();
    if (byDefault) return byDefault as SiteRow;

    // slug fallback
    const { data: bySlug } = await supabaseAdmin
      .from('sites')
      .select('id, slug, domain, default_subdomain, template_id, published_snapshot_id')
      .eq('slug', sub)
      .maybeSingle();
    if (bySlug) return bySlug as SiteRow;
  }

  // 3) Local dev: <slug>.localhost
  if (hostNoPort.endsWith('.localhost')) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -('.localhost'.length));
    const { data: bySlugLocal } = await supabaseAdmin
      .from('sites')
      .select('id, slug, domain, default_subdomain, template_id, published_snapshot_id')
      .eq('slug', sub)
      .maybeSingle();
    if (bySlugLocal) return bySlugLocal as SiteRow;
  }

  if (error) qlog('sites lookup error', error?.message || error);
  return null;
}

/* ---------- data loader ---------- */
async function loadSiteForRequest(previewSnapshotId?: string | null): Promise<{ site: RenderSite; host: string; templateId: string | null; isPreview: boolean } | null> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '')
    .toLowerCase()
    .replace(/\.$/, '');
  const hostNoPort = host.split(':')[0];
  if (!hostNoPort) return null;

  qlog('env', { baseDomain: BASE_DOMAIN, host: hostNoPort, previewSnapshotId });

  const siteRow = await findSiteByHost(hostNoPort);
  if (!siteRow) {
    qlog('NOT FOUND site row – returning 404', { host: hostNoPort });
    return null;
  }

  // Choose snapshot: preview ? preview : published
  const snapId = previewSnapshotId || siteRow.published_snapshot_id || null;

  let normalized: RenderSite | null = null;

  if (snapId) {
    const snap = await loadSnapshotById(snapId);
    if (snap?.data) {
      normalized = normalizeForRenderer(snap.data, {
        id: siteRow.id,
        slug: siteRow.slug,
        domain: siteRow.domain,
        default_subdomain: siteRow.default_subdomain,
      });
      qlog('render snapshot', { snapId, pages: normalized.pages?.length ?? 0 });
    }
  }

  // Backstop (dev): if no snapshot, render the draft template
  if (!normalized && siteRow.template_id) {
    const draft = await loadDraftTemplate(siteRow.template_id);
    if (draft?.data) {
      normalized = normalizeForRenderer(draft.data, draft.siteFields);
      qlog('render draft backstop', { pages: normalized.pages?.length ?? 0 });
    }
  }

  if (!normalized) return null;

  return { site: normalized, host: hostNoPort, templateId: siteRow.template_id ?? null, isPreview: Boolean(previewSnapshotId) };
}

/* ---------- metadata ---------- */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { rest?: string[] };
  searchParams?: Record<string, string | string[] | undefined>;
}): Promise<Metadata> {
  const previewSnapshotId =
    (Array.isArray(searchParams?.preview_snapshot_id)
      ? searchParams?.preview_snapshot_id?.[0]
      : searchParams?.preview_snapshot_id) ?? null;

  const payload = await loadSiteForRequest(previewSnapshotId);
  if (!payload) return {};
  const { site } = payload;
  const pageSlug = (params?.rest && params.rest[0]) || firstPageSlug(site);
  return generatePageMetadata({ site: site as any, pageSlug, baseUrl: await originFromHeaders() });
}

/* ---------- page ---------- */
export default async function HostSitePage({
  params,
  searchParams,
}: {
  params: { rest?: string[] };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const previewSnapshotId =
    (Array.isArray(searchParams?.preview_snapshot_id)
      ? searchParams?.preview_snapshot_id?.[0]
      : searchParams?.preview_snapshot_id) ?? null;

  const payload = await loadSiteForRequest(previewSnapshotId);
  if (!payload) return notFound();

  let { site } = payload;

  // Per-site A/B (lib/ab/siteAb.ts) — the same decision as /sites/[slug]: cookie or a fresh
  // draw, B swaps the hero. Never on a preview snapshot.
  let abStamp: string | undefined;
  let abBeacon: React.ReactNode = null;
  if (payload.templateId && !payload.isPreview) {
    const test = await getSiteAb(payload.templateId).catch(() => null);
    if (test?.enabled && test.b) {
      // `/a` and `/b` → `?ab=A` / `?ab=B` (only when no page has that slug).
      const shortcut = previewPathVariant(params?.rest, ((site as any)?.pages ?? []).map((pg: any) => String(pg?.slug ?? '')));
      if (shortcut) redirect(`/?ab=${shortcut}`);
      const forced = forcedVariant(searchParams?.ab);
      const experiment = siteExperimentId(payload.templateId);
      if (forced) {
        // A preview: the owner looking at one variant. Not counted, no cookie, no beacon.
        if (forced === 'B') site = applySiteVariantB(site, test.b.hero);
        abStamp = `${experiment}|${forced}|${AB_PREVIEW_MARK}`;
      } else {
        const cookieVal = (await cookies()).get(siteAbCookie(payload.templateId))?.value ?? null;
        const picked = pickSiteVariant(test, cookieVal);
        if (picked.variant === 'B') site = applySiteVariantB(site, test.b.hero);
        abStamp = `${experiment}|${picked.variant}`;
        abBeacon = <AbBeacon experiment={experiment} variant={picked.variant} assigned={picked.assigned} />;
      }
    }
  }

  // Redirects → page → reserved app path → 404. Before this, an unknown path rendered the home
  // page with a 200 (lib/sites/redirects.ts explains what that cost). Reserved paths keep their
  // previous behaviour on this route, deliberately: not changed here.
  const decision = resolvePublicPath(site as any, params?.rest);
  if (decision.kind === 'redirect') {
    if (decision.permanent) permanentRedirect(decision.to);
    redirect(decision.to);
  }
  if (decision.kind === 'not_found') return notFound();

  const pageSlug = decision.kind === 'page' ? decision.slug : (params?.rest && params.rest[0]) || firstPageSlug(site);
  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = await originFromHeaders();
  const siteLang = siteLocale(site);

  qlog('RENDER', { pageSlug, pagesLen: site.pages?.length });

  // Ensure correct theme before hydration/paint
  const inline = `(function(m){try{
    var h=document.documentElement,b=document.body;
    h.lang='${siteLang}';
    if(m==='dark'){h.classList.add('dark');b.classList.add('dark');h.dataset.theme='dark';b.dataset.theme='dark';}
    else {h.classList.remove('dark');b.classList.remove('dark');h.dataset.theme='light';b.dataset.theme='light';}
    document.cookie='qs-site-theme='+m+'; Path=/; Max-Age=31536000; SameSite=Lax';
  }catch(e){}})('${colorMode}');`;

  return (
    <>
      <Script id="qs-site-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: inline }} />
      <SiteThemeSetter mode={colorMode} lang={siteLang} />

      <TemplateEditorProvider
        templateName={site.template_name ?? site.slug ?? String(site.id)}
        colorMode={colorMode}
        initialData={site as any}
        // Custom-domain public render — same visitor's-browser case as /sites/[slug].
        readOnly
      >
        {abBeacon}
        <SiteRenderer
          site={site as any}
          page={pageSlug}
          baseUrl={baseUrl}
          abStamp={abStamp}
          id="site-renderer-page"
          colorMode={colorMode}
          // No surface class here — the theme wrapper paints it, and a second opaque fill on
          // this element covers the site's backdrop layers. Same reason as the /sites/[slug]
          // render; this is the custom-domain path, which is how most live sites are served,
          // so fixing only the other one would have left the majority of the fleet unchanged.
        />
      </TemplateEditorProvider>
    </>
  );
}
