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

// helper to log without leaking secrets
function qlog(msg: string, extra?: any) {
  if (!QS_DEBUG) return;
  try {
    // mask keys if they somehow slip in
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
  domain_lc: string | null;
  published: boolean | null;
  is_site: boolean | null;
  archived: boolean | null;
};

const SELECT =
  'id, slug, template_name, data, header_block, footer_block, color_mode, meta, default_subdomain, domain_lc, published, is_site, archived';

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'quicksites.ai';

/* ---------- tiny helpers ---------- */
async function originFromHeaders(): Promise<string> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .toLowerCase()
    .replace(/\.$/, '');
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function firstPageSlug(site: PublicSiteRow): string {
  const pages = (site?.data as any)?.pages ?? [];
  const first = Array.isArray(pages) ? pages.find((p: any) => p?.slug) ?? pages[0] : null;
  return (first?.slug as string) || 'home';
}

async function getHostAndVariants(): Promise<{ host: string; variants: string[] }> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '')
    .toLowerCase()
    .replace(/\.$/, '');
  const variants = host.startsWith('www.')
    ? [host, host.slice(4)]
    : [host, `www.${host}`];
  return { host, variants };
}

async function readClient() {
  // normal SSR client first; we’ll fallback to admin if needed
  return await getServerSupabase();
}

/* single place to run the select */
async function fetchByDomainVariants(client: any, variants: string[]) {
  try {
    const { data, error } = await client
      .from('templates')
      .select(SELECT)
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .in('domain_lc', variants)
      .maybeSingle();

    if (error) {
      console.error('Error fetching domain variants:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Unexpected error fetching domain variants:', err);
    return null;
  }
}

async function loadSiteForRequest(): Promise<{ site: PublicSiteRow; host: string } | null> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '')
    .toLowerCase()
    .replace(/\.$/, '');
  const variants = host.startsWith('www.') ? [host, host.slice(4)] : [host, `www.${host}`];

  qlog('env', {
    baseDomain: BASE_DOMAIN,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    useAdminFallback: true, // we’ll try it below unconditionally
    host, variants,
  });

  if (!host) return null;

  const s1 = await getServerSupabase();

  const r1 = await s1
  .from('templates')
  .select(SELECT)
  .eq('is_site', true)
  .eq('published', true)
  .eq('archived', false)
  .in('domain_lc', variants)
  .returns<PublicSiteRow>()       // <-- add this
  .maybeSingle();

  let site: PublicSiteRow | null = r1.data ?? null;  // <-- type the variable


  qlog('SSR query by domain_lc', { error: r1.error?.message ?? null, found: !!r1.data });



  // *.BASE_DOMAIN fallback
  if (!site && host.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = host.slice(0, -(BASE_DOMAIN.length + 1));

    const r2 = await s1
    .from('templates')
    .select(SELECT)
    .eq('is_site', true)
    .eq('published', true)
    .eq('archived', false)
    .eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
    .returns<PublicSiteRow>()       // <-- add
    .maybeSingle();
  site = site ?? r2.data ?? null;

  if (!site) {
    const r3 = await s1
      .from('templates')
      .select(SELECT)
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .eq('slug', sub)
      .returns<PublicSiteRow>()     // <-- add
      .maybeSingle();
    site = r3.data ?? null;
  }
  
  }

  // Admin fallback (service role) – belt & suspenders
  if (!site) {
    const a1 = await supabaseAdmin
    .from('templates')
    .select(SELECT)
    .eq('is_site', true)
    .eq('published', true)
    .eq('archived', false)
    .in('domain_lc', variants)
    .returns<PublicSiteRow>()       // <-- add
    .maybeSingle();
  site = site ?? a1.data ?? null;

    if (!site && host.endsWith(`.${BASE_DOMAIN}`)) {
      const sub = host.slice(0, -(BASE_DOMAIN.length + 1));
      const a2 = await supabaseAdmin
        .from('templates')
        .select(SELECT)
        .eq('is_site', true).eq('published', true).eq('archived', false)
        .eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
        .returns<PublicSiteRow>()
        .maybeSingle();
      qlog('ADMIN by default_subdomain', { sub, error: a2.error?.message ?? null, found: !!a2.data });
      site = a2.data ?? null;

      if (!site) {
        const a3 = await supabaseAdmin
          .from('templates')
          .select(SELECT)
          .eq('is_site', true).eq('published', true).eq('archived', false)
          .eq('slug', sub)
          .returns<PublicSiteRow>()
          .maybeSingle();
        qlog('ADMIN by slug', { sub, error: a3.error?.message ?? null, found: !!a3.data });
        site = a3.data ?? null;
      }
    }
  }

  if (!site) {
    qlog('NOT FOUND – returning 404', { host, variants });
    return null;
  }
  const found: PublicSiteRow = site;  // <-- narrow once, use below
  qlog('FOUND site', { id: found.id, slug: found.slug, domain_lc: found.domain_lc });
  return { site: found, host };
}


/* ---------- Metadata ---------- */
export async function generateMetadata({ params }: { params: { rest?: string[] } }): Promise<Metadata> {
  const payload = await loadSiteForRequest();
  if (!payload) return {};
  const { site } = payload;
  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  return generatePageMetadata({ site: site as any, pageSlug, baseUrl: await originFromHeaders() });
}

/* ---------- Page ---------- */
export default async function HostSitePage({ params }: { params: { rest?: string[] } }) {
  const payload = await loadSiteForRequest();
  if (!payload) return notFound();

  const { site } = payload;
  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = await originFromHeaders();

  return (
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
  );
}
