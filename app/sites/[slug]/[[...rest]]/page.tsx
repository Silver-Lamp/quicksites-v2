// app/sites/[slug]/[[...rest]]/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getServerSupabase } from '@/lib/supabase/server';
import SiteRenderer from '@/components/sites/site-renderer';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';

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

const SELECT: string =
  'id, slug, template_name, data, header_block, footer_block, color_mode, meta, default_subdomain, domain_lc, published, is_site, archived, template_name'; // TODO: fix this

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

async function loadSiteBySlug(slug: string | null, opts: { allowDraft: boolean }): Promise<PublicSiteRow | null> {
  const supabase = await getServerSupabase();

  let q = supabase
    .from('templates')
    .select(SELECT)
    .eq('slug', slug)
    .eq('is_site', true)
    .limit(1);

  if (!opts.allowDraft) {
    // Public preview path: only show published, non-archived
    q = q.eq('published', true).eq('archived', false);
  }

  const { data, error } = await q.returns<PublicSiteRow>().maybeSingle();
  if (error) throw new Error(error.message);
  return data ?? null;
}

async function isAdminUser(userId: string | null) {
  if (!userId) return false;
  const supabase = await getServerSupabase();
  const { data } = await supabase
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/* -------------------- Metadata -------------------- */
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { slug: string; rest?: string[] };
  searchParams?: { preview?: string };
}): Promise<Metadata> {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await isAdminUser(user?.id ?? null);

  // Only admins/owners should see drafts here (owner check happens via RLS)
  const site = await loadSiteBySlug(params.slug, { allowDraft: admin });
  if (!site) return {};

  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  // Keep your existing SEO generator contract: it likely builds /sites/{slug}/{page}
  return generatePageMetadata({ site: site as any, pageSlug, baseUrl: `${await originFromHeaders()}/sites` }); // TODO: fix this
}

/* ---------------------- Page ---------------------- */
export default async function SitePreviewPage({
  params,
  searchParams,
}: {
  params: { slug: string; rest?: string[] };
  searchParams?: { preview?: string };
}) {
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = await isAdminUser(user?.id ?? null);

  // Published path for the public; draft/archived visible only to admin/owner via RLS
  const site = await loadSiteBySlug(params?.slug ?? '', { allowDraft: admin });
  if (!site) return notFound();

  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  const colorMode = (site.color_mode ?? 'light') as 'light' | 'dark'; // TODO: fix this
  const baseUrl = `${await originFromHeaders()}/sites`;

  return (
    <TemplateEditorProvider
      templateName={site.template_name ?? site.slug ?? String(site.id)} // TODO: fix this
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
