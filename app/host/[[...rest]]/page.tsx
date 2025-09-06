// app/admin/templates/host/[[...rest]]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Script from 'next/script';

import SiteRenderer from '@/components/sites/site-renderer';
import SiteThemeSetter from '@/components/sites/site-theme-setter';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { supabaseAdmin } from '@/lib/supabase/admin';

const QS_DEBUG = process.env.QSITES_DEBUG === '1';
const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'quicksites.ai';

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
  let { data: site, error } = await supabaseAdmin
    .from('sites')
    .select('id, slug, domain, default_subdomain, template_id, published_snapshot_id')
    .in('domain', variants)
    .maybeSingle();

  if (site) return site as SiteRow;

  // 2) *.BASE_DOMAIN
  if (hostNoPort.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -(`.${BASE_DOMAIN}`).length);
    // default_subdomain exact match
    const { data: byDefault } = await supabaseAdmin
      .from('sites')
      .select('id, slug, domain, default_subdomain, template_id, published_snapshot_id')
      .eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
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
async function loadSiteForRequest(previewSnapshotId?: string | null): Promise<{ site: RenderSite; host: string } | null> {
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

  return { site: normalized, host: hostNoPort };
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

  const { site } = payload;
  const pageSlug = (params?.rest && params.rest[0]) || firstPageSlug(site);
  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = await originFromHeaders();

  qlog('RENDER', { pageSlug, pagesLen: site.pages?.length });

  // Ensure correct theme before hydration/paint
  const inline = `(function(m){try{
    var h=document.documentElement,b=document.body;
    if(m==='dark'){h.classList.add('dark');b.classList.add('dark');h.dataset.theme='dark';b.dataset.theme='dark';}
    else {h.classList.remove('dark');b.classList.remove('dark');h.dataset.theme='light';b.dataset.theme='light';}
    document.cookie='qs-site-theme='+m+'; Path=/; Max-Age=31536000; SameSite=Lax';
  }catch(e){}})('${colorMode}');`;

  return (
    <>
      <Script id="qs-site-theme" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: inline }} />
      <SiteThemeSetter mode={colorMode} />

      <TemplateEditorProvider
        templateName={site.template_name ?? site.slug ?? String(site.id)}
        colorMode={colorMode}
        initialData={site as any}
      >
        <SiteRenderer
          site={site as any}
          page={pageSlug}
          baseUrl={baseUrl}
          id="site-renderer-page"
          colorMode={colorMode}
          className="bg-white text-black dark:bg-black dark:text-white"
        />
      </TemplateEditorProvider>
    </>
  );
}
