// app/_sites/[slug]/[[...rest]]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import SiteRenderer from '@/components/sites/site-renderer';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { getSiteBySlug } from '@/lib/templates/getSiteBySlug';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';

// Force SSR & disable caching so the route never gets statically optimized.
// This fixes the "hard refresh -> 404" behavior.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;

function buildOrigin(h: Headers) {
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function firstPageSlug(site: any): string {
  const pages = site?.data?.pages ?? site?.pages ?? [];
  if (!Array.isArray(pages) || pages.length === 0) return 'home';

  const home = pages.find((p: any) => p?.isHome || p?.slug === 'home');
  const withSlug = pages.find((p: any) => p?.slug);
  return (home?.slug || withSlug?.slug || pages[0]?.slug || 'home') as string;
}

export async function generateMetadata(
  { params }: { params: { slug: string; rest?: string[] } }
): Promise<Metadata> {
  const site = await getSiteBySlug(params.slug);
  if (!site) return {};

  const h = await headers();
  const baseUrl = `${buildOrigin(h)}/_sites`;
  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);

  return generatePageMetadata({ site, pageSlug, baseUrl });
}

export default async function Page(
  { params }: { params: { slug: string; rest?: string[] } }
) {
  const site = await getSiteBySlug(params.slug);
  if (!site) return notFound();

  const h = await headers();
  const baseUrl = `${buildOrigin(h)}/_sites`;
  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  const colorMode = (site.color_mode as 'light' | 'dark') ?? 'light';

  return (
    <TemplateEditorProvider
      templateName={site.template_name}
      colorMode={colorMode}
      initialData={site}
    >
      <SiteRenderer
        id="site-renderer-page"
        className="bg-white text-black dark:bg-black dark:text-white"
        site={site}
        page={pageSlug}
        baseUrl={baseUrl}
        colorMode={colorMode}
      />
    </TemplateEditorProvider>
  );
}
