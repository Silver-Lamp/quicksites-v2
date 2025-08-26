// components/editor/live-editor/LiveEditorPreview.tsx

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import SiteRenderer from '@/components/sites/site-renderer';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';

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

{/* ---------- types ---------- */}
type PublicSiteRow = {
  id: string;
  slug: string | null;
  template_name: string | null;

  data: any;
  header_block: any | null;
  footer_block: any | null;

  color_mode: 'light' | 'dark' | null;
  meta: any | null;

  default_subdomain: string | null;
  domain: string | null;

  published: boolean | null;
  is_site: boolean | null; // may be NULL on version rows
  archived: boolean | null;

  services: string[] | null;
  contact_email: string | null;
  phone: string | null;
  business_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
};

const SELECT_VIEW = [
  'id', 'slug', 'template_name',
  'data', 'header_block', 'footer_block',
  'color_mode', 'meta',
  'default_subdomain', 'domain',
  'published', 'is_site', 'archived',
  'services', 'contact_email', 'phone', 'business_name',
  'address_line1', 'address_line2', 'city', 'state', 'postal_code',
  'latitude', 'longitude',
].join(', ');

// Minimal selection for prod if a view/column is missing
const SELECT_MIN = [
  'id','slug','template_name','data',
  'header_block','footer_block','color_mode',
  'default_subdomain','domain','published','is_site','archived'
].join(', ');

  {/* ---------- helpers ---------- */} 

async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .toLowerCase()
    .replace(/\.$/, '');
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function firstPageSlug(site: PublicSiteRow): string {
  const pages = Array.isArray((site as any)?.pages)
    ? (site as any).pages
    : ((site as any)?.data?.pages ?? []);
  const first = Array.isArray(pages) ? pages.find((p: any) => p?.slug) ?? pages[0] : null;
  return (first?.slug as string) || 'home';
}

function normalizeForRenderer(site: any) {
  return {
    ...site,
    pages: Array.isArray(site?.pages) ? site.pages : site?.data?.pages ?? [],
    headerBlock:
      site?.headerBlock ??
      site?.header_block ??
      site?.data?.headerBlock ??
      site?.data?.header ??
      null,
    footerBlock:
      site?.footerBlock ??
      site?.footer_block ??
      site?.data?.footerBlock ??
      site?.data?.footer ??
      null,
  };
}

function composeEffective(c: any, v?: any): PublicSiteRow {
  const parse = (x: any) =>
    typeof x === 'string'
      ? (() => { try { return JSON.parse(x); } catch { return null; } })()
      : x;

  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;

  const cData = parse(c?.data) ?? {};
  const vData = parse(v?.data) ?? {};

  // Prefer version content only if it actually has pages
  const contentData = hasPages(vData) ? vData : cData;

  const pick = (a: any, b: any): any =>
    (a ?? b) ?? null;

  const vServices: string[] = Array.isArray(v?.services_jsonb) ? v.services_jsonb : [];
  const cServices: string[] = Array.isArray(c?.services_jsonb) ? c.services_jsonb : [];

  return {
    id: (v?.id ?? c?.id) as string,
    slug: (c?.slug ?? null) as string | null,
    template_name: (c?.template_name ?? null) as string | null,

    data: contentData,
    header_block: pick(v?.header_block, c?.header_block),
    footer_block: pick(v?.footer_block, c?.footer_block),

    color_mode: (pick(v?.color_mode, c?.color_mode) ?? null) as 'light' | 'dark' | null,
    meta: (c?.meta ?? null),

    default_subdomain: (c?.default_subdomain ?? null),
    domain: (c?.domain ?? null),

    published: (c?.published ?? null),
    is_site: (c?.is_site ?? null),
    archived: (c?.archived ?? null),

    services: (vServices.length ? vServices : cServices) ?? [],
    contact_email: (c?.contact_email ?? null),
    phone: (c?.phone ?? null),
    business_name: (c?.business_name ?? null),
    address_line1: (c?.address_line1 ?? null),
    address_line2: (c?.address_line2 ?? null),
    city: (c?.city ?? null),
    state: (c?.state ?? null),
    postal_code: (c?.postal_code ?? null),
    latitude: (c?.latitude ?? null),
    longitude: (c?.longitude ?? null),
  };
}

  {/* Try effective → latest; if a 400 comes from unknown columns, retry with SELECT_MIN */}
async function safeSelectWithDowngrade(
  client: any,
  build: (from: any, select: string) => any
) {
  try {
    const r1 = await build(client.from('templates_effective'), SELECT_VIEW).maybeSingle();
    if (r1?.data) return r1 as { data: PublicSiteRow | null; error: any };
    if (r1?.error && String(r1.error.message || '').toLowerCase().includes('column')) {
      const r1m = await build(client.from('templates_effective'), SELECT_MIN).maybeSingle();
      if (r1m?.data) return r1m as any;
    }
  } catch (e: any) {
    qlog('effective view error', e?.message || e);
  }
  try {
    const r2 = await build(client.from('templates_latest'), SELECT_VIEW).maybeSingle();
    if (r2?.data) return r2 as any;
    if (r2?.error && String(r2.error.message || '').toLowerCase().includes('column')) {
      const r2m = await build(client.from('templates_latest'), SELECT_MIN).maybeSingle();
      return r2m as any;
    }
  } catch (e: any) {
    qlog('latest view error', e?.message || e);
  }
  return { data: null, error: null };
}

  {/* Manual compose by custom domain (service role), with optional forced version id */}
async function manualByDomain(
  domainVariants: string[],
  forcedVersionId?: string | null
): Promise<PublicSiteRow | null> {
  const { data: c } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('archived', false)
    .eq('is_version', false)
    .in('domain', domainVariants)
    .maybeSingle();
  if (!c) return null;

  let v: any = null;
  if (forcedVersionId) {
    const r = await supabaseAdmin.from('templates').select('*').eq('id', forcedVersionId).maybeSingle();
    v = r.data ?? null;
  } else if (c.published_version_id) {
    const r = await supabaseAdmin.from('templates').select('*').eq('id', c.published_version_id).maybeSingle();
    v = r.data ?? null;
  } else {
    const r = await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('base_slug', c.base_slug)
      .eq('is_version', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    v = r.data ?? null;
  }

  const site = composeEffective(c, v || undefined);

  // Backstop: if result still has no pages, prefer canonical pages
  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;
  if (!hasPages(site?.data)) {
    const parse = (x: any) => (typeof x === 'string' ? (() => { try { return JSON.parse(x); } catch { return null; } })() : x);
    const cData = parse(c?.data) ?? {};
    if (hasPages(cData)) site.data = cData;
  }
  return site;
}

  {/* Manual compose by slug/base (service role) — used for *.localhost and preview by slug */}
async function manualBySlugOrBase(
  sub: string,
  forcedVersionId?: string | null
): Promise<PublicSiteRow | null> {
  const { data: c } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('archived', false)
    .eq('is_version', false)
    .or(`base_slug.eq.${sub},slug.eq.${sub}`)
    .maybeSingle();
  if (!c) return null;

  let v: any = null;
  if (forcedVersionId) {
    const r = await supabaseAdmin.from('templates').select('*').eq('id', forcedVersionId).maybeSingle();
    v = r.data ?? null;
  } else if (c.published_version_id) {
    const r = await supabaseAdmin.from('templates').select('*').eq('id', c.published_version_id).maybeSingle();
    v = r.data ?? null;
  } else {
    const r = await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('base_slug', c.base_slug)
      .eq('is_version', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    v = r.data ?? null;
  }

  const site = composeEffective(c, v || undefined);

  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;
  if (!hasPages(site?.data)) {
    const parse = (x: any) => (typeof x === 'string' ? (() => { try { return JSON.parse(x); } catch { return null; } })() : x);
    const cData = parse(c?.data) ?? {};
    if (hasPages(cData)) site.data = cData;
  }
  return site;
}

  {/* ---------- data loader ---------- */}
async function loadSiteForRequest(previewVersionId?: string | null): Promise<{ site: PublicSiteRow; host: string } | null> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '')
    .toLowerCase()
    .replace(/\.$/, '');
  const hostNoPort = host.split(':')[0];
  const variants =
    hostNoPort.startsWith('www.')
      ? [hostNoPort, hostNoPort.slice(4)]
      : [hostNoPort, `www.${hostNoPort}`];

  qlog('env', { baseDomain: BASE_DOMAIN, host: hostNoPort, variants, previewVersionId });
  if (!hostNoPort) return null;

  const s1 = await getServerSupabase();
  let site: PublicSiteRow | null = null;

  // 1) Custom domains
  if (previewVersionId) {
    site = await manualByDomain(variants, previewVersionId);
    qlog('MANUAL by domain (forced version)', { found: !!site });
  } else {
    const res = await safeSelectWithDowngrade(s1, (from, sel) =>
      from.select(sel).eq('archived', false).in('domain', variants)
    );
    site = res.data ?? null;
    qlog('VIEW by domain', { found: !!res.data });
    if (!site) {
      site = await manualByDomain(variants);
      qlog('MANUAL by domain (fallback)', { found: !!site });
    }
  }

  // 2) *.BASE_DOMAIN (slug.quicksites.ai)
  if (!site && hostNoPort.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -(`.${BASE_DOMAIN}`).length);

    if (previewVersionId) {
      site = await manualBySlugOrBase(sub, previewVersionId);
      qlog('MANUAL by base (forced version)', { sub, found: !!site });
    } else {
      let res = await safeSelectWithDowngrade(s1, (from, sel) =>
        from.select(sel).eq('archived', false).eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
      );
      site = res.data ?? null;
      qlog('VIEW by default_subdomain', { sub, found: !!res.data });

      if (!site) {
        res = await safeSelectWithDowngrade(s1, (from, sel) =>
          from.select(sel).eq('archived', false).or(`slug.eq.${sub},base_slug.eq.${sub}`)
        );
        site = res.data ?? null;
        qlog('VIEW by slug/base_slug', { sub, found: !!res.data });

        if (!site) {
          site = await manualBySlugOrBase(sub);
          qlog('MANUAL by base (fallback)', { sub, found: !!site });
        }
      }
    }
  }

  // 3) Local dev: <slug>.localhost — manual compose (supports preview)
  if (!site && hostNoPort.endsWith('.localhost')) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -('.localhost'.length));
    site = await manualBySlugOrBase(sub, previewVersionId);
    qlog('LOCAL effective composed', { sub, found: !!site });
  }

  if (!site) {
    qlog('NOT FOUND – returning 404', { host: hostNoPort, variants });
    return null;
  }

  qlog('FOUND site', { id: site.id, slug: site.slug, domain: site.domain });
  return { site, host: hostNoPort };
}

  {/* ---------- metadata ---------- */}
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const payload = await loadSiteForRequest();
  if (!payload) return {};
  const { site } = payload;
  const { rest } = await params;
  const pageSlug = rest?.[0] ?? firstPageSlug(site);
  return generatePageMetadata({ site: site as any, pageSlug, baseUrl: await originFromHeaders() });
}

  {/* ---------- page ---------- */}  
export default async function HostSitePage({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = (await (searchParams ?? Promise.resolve({}))) as { preview_version_id?: string | string[] | undefined };
  const previewVersionId = (Array.isArray(sp.preview_version_id) ? sp.preview_version_id[0] : sp.preview_version_id) ?? null;

  const payload = await loadSiteForRequest(previewVersionId);
  if (!payload) return notFound();

  const { site } = payload;
  const { rest } = await params;
  const pageSlug = rest?.[0] ?? firstPageSlug(site);
  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = await originFromHeaders();

  const normalized = normalizeForRenderer(site);
  qlog('render pages', { count: normalized.pages?.length ?? 0, slugs: (normalized.pages ?? []).map((p: any) => p.slug) });

  return (
    <TemplateEditorProvider
      templateName={normalized.template_name ?? normalized.slug ?? String(normalized.id)}
      colorMode={colorMode}
      initialData={normalized}
    >
      <SiteRenderer
        site={normalized}
        page={pageSlug}
        baseUrl={baseUrl}
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
      />
    </TemplateEditorProvider>
  );
}
