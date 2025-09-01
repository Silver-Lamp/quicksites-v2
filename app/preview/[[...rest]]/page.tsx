// app/preview/[[...rest]]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getServerSupabase } from '@/lib/supabase/server';
import PreviewBridge from '@/app/preview/preview-bridge';
import PreviewState from '@/app/preview/PreviewState';

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

/* ---------- types / constants ---------- */
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
  is_site: boolean | null;
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
  'id','slug','template_name','data','header_block','footer_block','color_mode','meta',
  'default_subdomain','domain','published','is_site','archived','services','contact_email',
  'phone','business_name','address_line1','address_line2','city','state','postal_code',
  'latitude','longitude',
].join(', ');

const SELECT_MIN = [
  'id','slug','template_name','data','header_block','footer_block','color_mode',
  'default_subdomain','domain','published','is_site','archived',
].join(', ');

/* ---------- helpers ---------- */
async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .toLowerCase()
    .replace(/\.$/, '');
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function firstPageSlug(siteOrTemplate: any): string {
  const pages = Array.isArray(siteOrTemplate?.pages)
    ? siteOrTemplate.pages
    : siteOrTemplate?.data?.pages ?? [];
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

function safeParse(x: any) {
  if (typeof x !== 'string') return x;
  try { return JSON.parse(x); } catch { return {}; }
}

function composeEffective(c: any, v?: any): PublicSiteRow {
  const parse = (x: any) => safeParse(x);
  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;

  const cData = parse(c?.data) ?? {};
  const vData = parse(v?.data) ?? {};
  const contentData = hasPages(vData) ? vData : cData;

  const pick = (a: any, b: any): any => (a ?? b) ?? null;

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
    meta: c?.meta ?? null,
    default_subdomain: c?.default_subdomain ?? null,
    domain: c?.domain ?? null,
    published: c?.published ?? null,
    is_site: c?.is_site ?? null,
    archived: c?.archived ?? null,
    services: (vServices.length ? vServices : cServices) ?? [],
    contact_email: c?.contact_email ?? null,
    phone: c?.phone ?? null,
    business_name: c?.business_name ?? null,
    address_line1: c?.address_line1 ?? null,
    address_line2: c?.address_line2 ?? null,
    city: c?.city ?? null,
    state: c?.state ?? null,
    postal_code: c?.postal_code ?? null,
    latitude: c?.latitude ?? null,
    longitude: c?.longitude ?? null,
  };
}

async function safeSelectWithDowngrade(client: any, build: (from: any, select: string) => any) {
  try {
    const r1 = await build(client.from('templates_effective'), SELECT_VIEW).maybeSingle();
    if (r1?.data) return r1 as { data: PublicSiteRow | null; error: any };
    if (r1?.error && String(r1.error.message || '').toLowerCase().includes('column')) {
      const r1m = await build(client.from('templates_effective'), SELECT_MIN).maybeSingle();
      if (r1m?.data) return r1m as any;
    }
  } catch (e: any) { qlog('effective view error', e?.message || e); }
  try {
    const r2 = await build(client.from('templates_latest'), SELECT_VIEW).maybeSingle();
    if (r2?.data) return r2 as any;
    if (r2?.error && String(r2.error.message || '').toLowerCase().includes('column')) {
      const r2m = await build(client.from('templates_latest'), SELECT_MIN).maybeSingle();
      return r2m as any;
    }
  } catch (e: any) { qlog('latest view error', e?.message || e); }
  return { data: null, error: null };
}

/* ----- snapshot/draft helpers for explicit preview ----- */
async function loadSnapshotById(id: string) {
  const { data, error } = await supabaseAdmin
    .from('snapshots')
    .select('id, template_id, data, created_at, hash')
    .eq('id', id)
    .maybeSingle();
  if (error) qlog('snapshot lookup failed', error.message || error);
  return data ?? null;
}

async function loadTemplateMeta(templateId: string) {
  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('id, slug, template_name, data, header_block, footer_block, color_mode, domain, default_subdomain')
    .eq('id', templateId)
    .maybeSingle();
  if (error) qlog('template meta lookup failed', error.message || error);
  return data ?? null;
}

/* ----- manual fetchers (legacy) ----- */
async function manualByDomain(domainVariants: string[], forcedVersionId?: string | null) {
  const { data: c } = await supabaseAdmin
    .from('templates').select('*')
    .eq('archived', false).eq('is_version', false)
    .in('domain', domainVariants).maybeSingle();
  if (!c) return null;

  let v: any = null;
  if (forcedVersionId) {
    v = (await supabaseAdmin.from('templates').select('*').eq('id', forcedVersionId).maybeSingle()).data ?? null;
  } else if (c.published_version_id) {
    v = (await supabaseAdmin.from('templates').select('*').eq('id', c.published_version_id).maybeSingle()).data ?? null;
  } else {
    v = (await supabaseAdmin.from('templates').select('*')
      .eq('base_slug', c.base_slug).eq('is_version', true)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()).data ?? null;
  }

  const site = composeEffective(c, v || undefined);
  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;
  const cData = safeParse(c?.data) ?? {};
  if (!hasPages(site?.data) && hasPages(cData)) site.data = cData;
  return site;
}

async function manualBySlugOrBase(sub: string, forcedVersionId?: string | null) {
  const { data: c } = await supabaseAdmin
    .from('templates').select('*')
    .eq('archived', false).eq('is_version', false)
    .or(`base_slug.eq.${sub},slug.eq.${sub}`).maybeSingle();
  if (!c) return null;

  let v: any = null;
  if (forcedVersionId) {
    v = (await supabaseAdmin.from('templates').select('*').eq('id', forcedVersionId).maybeSingle()).data ?? null;
  } else if (c.published_version_id) {
    v = (await supabaseAdmin.from('templates').select('*').eq('id', c.published_version_id).maybeSingle()).data ?? null;
  } else {
    v = (await supabaseAdmin.from('templates').select('*')
      .eq('base_slug', c.base_slug).eq('is_version', true)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()).data ?? null;
  }

  const site = composeEffective(c, v || undefined);
  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;
  const cData = safeParse(c?.data) ?? {};
  if (!hasPages(site?.data) && hasPages(cData)) site.data = cData;
  return site;
}

async function manualById(
  id: string,
  forcedVersionId?: string | null
): Promise<PublicSiteRow | null> {
  const { data: c } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('archived', false)
    .eq('is_version', false)
    .eq('id', id)
    .maybeSingle();
  if (!c) return null;

  let v: any = null;
  if (forcedVersionId) {
    v = (await supabaseAdmin.from('templates').select('*').eq('id', forcedVersionId).maybeSingle()).data ?? null;
  } else if (c.published_version_id) {
    v = (await supabaseAdmin.from('templates').select('*').eq('id', c.published_version_id).maybeSingle()).data ?? null;
  } else {
    v = (await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('base_slug', c.base_slug)
      .eq('is_version', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()).data ?? null;
  }

  const site = composeEffective(c, v || undefined);
  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;
  const cData = safeParse(c?.data) ?? {};
  if (!hasPages(site?.data) && hasPages(cData)) site.data = cData;
  return site;
}

/* ---------- data loader ---------- */
async function loadSiteForRequest(opts: {
  previewVersionId?: string | null;
  previewSnapshotId?: string | null;     // NEW
  explicitTemplateId?: string | null;
  explicitSlug?: string | null;
} = {}) {
  const { previewVersionId, previewSnapshotId, explicitTemplateId, explicitSlug } = opts;

  // NEW: explicit snapshot preview has highest priority
  if (previewSnapshotId) {
    const snap = await loadSnapshotById(previewSnapshotId);
    if (snap?.template_id) {
      const tmpl = await loadTemplateMeta(snap.template_id);
      if (tmpl) {
        const normalized = normalizeForRenderer({
          ...tmpl,
          data: {
            ...(safeParse(snap.data) ?? {}),
            headerBlock: (safeParse(snap.data)?.headerBlock ?? tmpl.header_block) ?? null,
            footerBlock: (safeParse(snap.data)?.footerBlock ?? tmpl.footer_block) ?? null,
            color_mode: (safeParse(snap.data)?.color_mode ?? tmpl.color_mode) ?? 'light',
          },
        });
        return { site: normalized as any, host: 'preview-snapshot' };
      }
    }
  }

  if (explicitTemplateId) {
    const site = await manualById(explicitTemplateId, previewVersionId);
    if (site) return { site, host: 'explicit-id' };
  }
  if (explicitSlug) {
    const site = await manualBySlugOrBase(explicitSlug, previewVersionId);
    if (site) return { site, host: 'explicit-slug' };
  }

  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').toLowerCase().replace(/\.$/, '');
  const hostNoPort = host.split(':')[0];
  const variants = hostNoPort.startsWith('www.')
    ? [hostNoPort, hostNoPort.slice(4)]
    : [hostNoPort, `www.${hostNoPort}`];

  qlog('env', { baseDomain: BASE_DOMAIN, host: hostNoPort, variants, previewVersionId, previewSnapshotId });
  if (!hostNoPort) return null;

  const s1 = await getServerSupabase();
  let site: PublicSiteRow | null = null;

  if (previewVersionId) {
    site = await manualByDomain(variants, previewVersionId);
  } else {
    const res = await safeSelectWithDowngrade(s1, (from, sel) => from.select(sel).eq('archived', false).in('domain', variants));
    site = res.data ?? null;
    if (!site) site = await manualByDomain(variants);
  }

  if (!site && hostNoPort.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -(`.${BASE_DOMAIN}`).length);
    site = previewVersionId
      ? await manualBySlugOrBase(sub, previewVersionId)
      : (await (async () => {
          let r = await safeSelectWithDowngrade(s1, (from, sel) =>
            from.select(sel).eq('archived', false).eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
          );
          if (r.data) return r.data as any;
          r = await safeSelectWithDowngrade(s1, (from, sel) =>
            from.select(sel).eq('archived', false).or(`slug.eq.${sub},base_slug.eq.${sub}`)
          );
          if (r.data) return r.data as any;
          return await manualBySlugOrBase(sub);
        })());
  }

  if (!site && hostNoPort.endsWith('.localhost')) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -('.localhost'.length));
    site = await manualBySlugOrBase(sub, previewVersionId);
  }

  if (!site) return null;
  return { site, host: hostNoPort };
}

/* ---------- metadata ---------- */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const pr = await params;

  const previewVersionId = Array.isArray(sp.preview_version_id) ? sp.preview_version_id[0] ?? null : (sp.preview_version_id as string | null) ?? null;
  const previewSnapshotId = Array.isArray(sp.preview_snapshot_id) ? sp.preview_snapshot_id[0] ?? null : (sp.preview_snapshot_id as string | null) ?? null; // NEW
  const explicitTemplateId = Array.isArray(sp.template_id) ? sp.template_id[0] ?? null : (sp.template_id as string | null) ?? null;
  const explicitSlug = Array.isArray(sp.slug) ? sp.slug[0] ?? null : (sp.slug as string | null) ?? null;

  const payload = await loadSiteForRequest({ previewVersionId, previewSnapshotId, explicitTemplateId, explicitSlug });
  if (!payload) return {};
  const { site } = payload;

  const pathSlug = pr?.rest && pr.rest.length > 0 ? pr.rest[0] : undefined;
  const pageParam = sp.page;
  const pageSlug = pathSlug ?? (Array.isArray(pageParam) ? pageParam[0] : pageParam) ?? firstPageSlug(site);

  return generatePageMetadata({
    site: site as any,
    pageSlug: String(pageSlug),
    baseUrl: await originFromHeaders(),
  });
}

/* ---------- page ---------- */
export default async function PreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const pr = await params;

  const previewVersionId = Array.isArray(sp.preview_version_id) ? sp.preview_version_id[0] ?? null : (sp.preview_version_id as string | null) ?? null;
  const previewSnapshotId = Array.isArray(sp.preview_snapshot_id) ? sp.preview_snapshot_id[0] ?? null : (sp.preview_snapshot_id as string | null) ?? null; // NEW
  const explicitTemplateId = Array.isArray(sp.template_id) ? sp.template_id[0] ?? null : (sp.template_id as string | null) ?? null;
  const explicitSlug = Array.isArray(sp.slug) ? sp.slug[0] ?? null : (sp.slug as string | null) ?? null;

  const payload = await loadSiteForRequest({ previewVersionId, previewSnapshotId, explicitTemplateId, explicitSlug });
  if (!payload) return notFound();

  const { site } = payload;

  const pathSlug = pr?.rest && pr.rest.length > 0 ? pr.rest[0] : undefined;
  const pageParam = sp.page;
  const pageSlug = pathSlug ?? (Array.isArray(pageParam) ? pageParam[0] : pageParam) ?? firstPageSlug(site);

  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = await originFromHeaders();
  const normalized = normalizeForRenderer(site);

  const editorChrome =
    (Array.isArray(sp.editor) ? sp.editor[0] : sp.editor) === '1' ||
    (Array.isArray(sp.chrome) ? sp.chrome[0] : sp.chrome) === '1';

  return (
    <TemplateEditorProvider
      templateName={normalized.template_name ?? normalized.slug ?? String(normalized.id)}
      colorMode={colorMode}
      initialData={normalized}
    >
      <PreviewBridge />
      <PreviewState
        initialSite={normalized}
        page={String(pageSlug)}
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
        id="site-renderer-page"
        editorChrome={editorChrome}
        baseUrl={baseUrl}
      />
    </TemplateEditorProvider>
  );
}
