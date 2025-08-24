// app/_sites/[...rest]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';
import SiteRenderer from '@/components/sites/site-renderer';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';

// Local row shape to avoid drift with generated types
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

// Keep selection identical across queries
const selectColumns =
  'id, slug, template_name, data, header_block, footer_block, color_mode, meta, default_subdomain, domain_lc, published, is_site, archived';

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN ?? 'quicksites.ai';

async function originFromHeaders() {
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

async function loadSiteForRequest(): Promise<{ site: PublicSiteRow; host: string } | null> {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '')
    .toLowerCase()
    .replace(/\.$/, '');
  if (!host) return null;

  const supabase = await getServerSupabase();

  // 1) Exact custom-domain match
  const r1 = await supabase
    .from('templates')
    .select(selectColumns)
    .eq('is_site', true)
    .eq('published', true)
    .eq('archived', false)
    .eq('domain_lc', host)
    .returns<PublicSiteRow>()
    .maybeSingle();

  let site = r1.data ?? null;

  // 2) *.BASE_DOMAIN subdomain support (e.g., foo.quicksites.ai)
  if (!site && host.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = host.slice(0, -(BASE_DOMAIN.length + 1)); // 'foo' from 'foo.quicksites.ai'

    // Prefer default_subdomain first
    const r2 = await supabase
      .from('templates')
      .select(selectColumns)
      .eq('is_site', true)
      .eq('published', true)
      .eq('archived', false)
      .eq('default_subdomain', `${sub}.${BASE_DOMAIN}`)
      .returns<PublicSiteRow>()
      .maybeSingle();
    site = r2.data ?? null;

    // Fallback: slug == subdomain
    if (!site) {
      const r3 = await supabase
        .from('templates')
        .select(selectColumns)
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

// Metadata
export async function generateMetadata({ params }: { params: { rest?: string[] } }): Promise<Metadata> {
  const payload = await loadSiteForRequest();
  if (!payload) return {};
  const { site } = payload;
  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  return generatePageMetadata({ site: site as any, pageSlug, baseUrl: await originFromHeaders() });
  // TODO: fix this
}

// Page
export default async function HostSitePage({ params }: { params: { rest?: string[] } }) {
  const payload = await loadSiteForRequest();
  if (!payload) return notFound();

  const { site } = payload;
  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark';
  const baseUrl = originFromHeaders();

  return (
    <TemplateEditorProvider
      templateName={site.template_name ?? site.slug ?? String(site.id)}
      colorMode={colorMode}
      initialData={site as any}
    >
      <SiteRenderer
        site={site as any}
        page={pageSlug}
        baseUrl={await baseUrl}
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
      />
    </TemplateEditorProvider>
  );
}
