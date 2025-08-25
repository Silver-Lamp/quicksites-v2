// app/_sites/[[...rest]]/page.tsx
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

/* ---------- Helpers ---------- */
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

async function getReadClient() {
  if (process.env.SITE_PUBLIC_READ_WITH_SERVICE_ROLE === '1') return supabaseAdmin; // server-only
  return await getServerSupabase();
}

async function loadSiteForRequest(): Promise<{ site: PublicSiteRow; host: string } | null> {
  const { host, variants } = await getHostAndVariants();
  if (!host) return null;

  const supabase = await getReadClient();

  // 1) custom domain (apex+www)
  const r1 = await supabase
    .from('templates')
    .select(SELECT)
    .eq('is_site', true)
    .eq('published', true)
    .eq('archived', false)
    .in('domain_lc', variants)
    .returns<PublicSiteRow>()
    .maybeSingle();
  let site = r1.data ?? null;

  // 2) *.BASE_DOMAIN subdomain fallback (e.g., foo.quicksites.ai)
  if (!site && host.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = host.slice(0, -(BASE_DOMAIN.length + 1));

    const r2 = await supabase
      .from('templates')
      .select(SELECT)
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
      .returns<PublicSiteRow>()
      .maybeSingle();
    site = r2.data ?? null;

    if (!site) {
      const r3 = await supabase
        .from('templates')
        .select(SELECT)
        .eq('is_site', true)
        .eq('published', true)
        .eq('archived', false)
        .eq('slug', sub)
        .returns<PublicSiteRow>()
        .maybeSingle();
      site = r3.data ?? null;
    }
  }

  if (!site) return null;
  return { site, host };
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
