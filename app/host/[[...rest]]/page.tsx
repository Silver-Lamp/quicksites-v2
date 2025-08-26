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

/* ---------- helpers ---------- */

// keep async if your TS setup types headers() as Promise<ReadonlyHeaders>
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
      ? (() => {
          try { return JSON.parse(x); } catch { return null; }
        })()
      : x;

  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;

  const cData = parse(c?.data) ?? {};
  const vData = parse(v?.data) ?? {};

  // prefer version content only if it actually has pages
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

async function getPublishedOrLatestVersionForCanonical(canonical: any) {
  if (!canonical) return null;

  if (canonical.published_version_id) {
    const { data, error } = await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('id', canonical.published_version_id)
      .maybeSingle();
    if (error) qlog('version lookup (published) failed', error);
    return data ?? null;
  }

  const { data, error } = await supabaseAdmin
    .from('templates')
    .select('*')
    .eq('base_slug', canonical.base_slug)
    .eq('is_version', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) qlog('version lookup (latest) failed', error);
  return data ?? null;
}

/* ---------- data loader ---------- */
async function loadSiteForRequest(): Promise<{ site: PublicSiteRow; host: string } | null> {
  const h = await headers();
  const hostRaw = (h.get('x-forwarded-host') ?? h.get('host') ?? '')
    .toLowerCase()
    .replace(/\.$/, '');
  const hostNoPort = hostRaw.split(':')[0];

  if (!hostNoPort) return null;

  const variants =
    hostNoPort.startsWith('www.')
      ? [hostNoPort, hostNoPort.slice(4)]
      : [hostNoPort, `www.${hostNoPort}`];

  qlog('env', { baseDomain: BASE_DOMAIN, host: hostNoPort, variants });

  let canonical: any = null;

  // A) Try custom domains directly on canonical `templates`
  {
    const { data, error } = await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('archived', false)
      .eq('is_version', false)
      .in('domain', variants)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) qlog('canonical by domain failed', error);
    if (data) {
      canonical = data;
      qlog('CANONICAL by domain', { id: canonical.id, domain: canonical.domain });
    }
  }

  // B) *.BASE_DOMAIN → default_subdomain, slug/base_slug fallbacks
  if (!canonical && hostNoPort.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -(`.${BASE_DOMAIN}`).length);

    // B1) default_subdomain exact match
    {
      const { data, error } = await supabaseAdmin
        .from('templates')
        .select('*')
        .eq('archived', false)
        .eq('is_version', false)
        .eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) qlog('canonical by default_subdomain failed', error);
      if (data) {
        canonical = data;
        qlog('CANONICAL by default_subdomain', { sub, id: canonical.id });
      }
    }

    // B2) slug / base_slug fallback
    if (!canonical) {
      // Try slug first
      let r = await supabaseAdmin
        .from('templates')
        .select('*')
        .eq('archived', false)
        .eq('is_version', false)
        .eq('slug', sub)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!r.data) {
        r = await supabaseAdmin
          .from('templates')
          .select('*')
          .eq('archived', false)
          .eq('is_version', false)
          .eq('base_slug', sub)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
      }

      if (r.error) qlog('canonical by slug/base_slug failed', r.error);
      if (r.data) {
        canonical = r.data;
        qlog('CANONICAL by slug/base_slug', { sub, id: canonical.id });
      }
    }
  }

  // C) Local dev: <slug>.localhost
  if (!canonical && hostNoPort.endsWith('.localhost')) {
    const sub = hostNoPort.replace(/^www\./, '').slice(0, -('.localhost'.length));

    // Try slug then base_slug then template_name
    let r = await supabaseAdmin
      .from('templates')
      .select('*')
      .eq('archived', false)
      .eq('is_version', false)
      .eq('slug', sub)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!r.data) {
      r = await supabaseAdmin
        .from('templates')
        .select('*')
        .eq('archived', false)
        .eq('is_version', false)
        .eq('base_slug', sub)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (!r.data) {
      r = await supabaseAdmin
        .from('templates')
        .select('*')
        .eq('archived', false)
        .eq('is_version', false)
        .eq('template_name', sub)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
    }

    if (r.error) qlog('LOCAL canonical lookup failed', r.error);
    if (r.data) {
      canonical = r.data;
      qlog('LOCAL CANONICAL', { sub, id: canonical.id });
    }
  }

  if (!canonical) {
    qlog('NOT FOUND – returning 404', { host: hostNoPort, variants });
    return null;
  }

  const version = await getPublishedOrLatestVersionForCanonical(canonical);
  const site = composeEffective(canonical, version || undefined);

  // Backstop: ensure there are pages; if not, try template_name canonical (rare datasets)
  const hasPages = (d: any) => !!d && Array.isArray(d.pages) && d.pages.length > 0;
  if (!hasPages(site?.data)) {
    const subAlt = canonical?.template_name ?? canonical?.slug ?? canonical?.base_slug;
    if (subAlt && subAlt !== canonical?.slug) {
      const r2 = await supabaseAdmin
        .from('templates')
        .select('*')
        .eq('archived', false)
        .eq('is_version', false)
        .eq('template_name', subAlt)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (r2.data) {
        const v2 = await getPublishedOrLatestVersionForCanonical(r2.data);
        const retry = composeEffective(r2.data, v2 || undefined);
        if (hasPages(retry?.data)) {
          qlog('Backstop: canonical-by-name used', { subAlt, usedVersion: !!v2?.id });
          return { site: retry, host: hostNoPort };
        }
      }
    }
  }

  qlog('FOUND site', { id: site.id, slug: site.slug, domain: site.domain });
  return { site, host: hostNoPort };
}

/* ---------- metadata ---------- */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}): Promise<Metadata> {
  const payload = await loadSiteForRequest();
  if (!payload) return {};
  const { site } = payload;
  const { rest } = await params;
  const pageSlug = rest?.[0] ?? firstPageSlug(site);
  return generatePageMetadata({ site: site as any, pageSlug, baseUrl: await originFromHeaders() });
}

/* ---------- page ---------- */
export default async function HostSitePage({
  params,
}: {
  params: Promise<{ rest?: string[] }>;
}) {
  const payload = await loadSiteForRequest();
  if (!payload) return notFound();

  const { site } = payload;
  const { rest } = await params;
  const pageSlug = rest?.[0] ?? firstPageSlug(site);
  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = await originFromHeaders();

  const normalized = normalizeForRenderer(site);
  qlog('RENDER', { pageSlug, pagesLen: normalized.pages?.length });

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
