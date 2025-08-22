// app/_sites/[slug]/[[...rest]]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import SiteRenderer from '@/components/sites/site-renderer';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { getSiteBySlug } from '@/lib/templates/getSiteBySlug';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';

async function getOrigin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function firstPageSlug(site: any): string {
  const pages = site?.data?.pages ?? site?.pages ?? [];
  const first = Array.isArray(pages) ? pages.find((p: any) => p?.slug) ?? pages[0] : null;
  return (first?.slug as string) || 'home';
}

export async function generateMetadata({
  params,
}: { params: { slug: string; rest?: string[] } }): Promise<Metadata> {
  const site = await getSiteBySlug(params.slug);
  if (!site) return {};
  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  return generatePageMetadata({ site, pageSlug, baseUrl: `${await getOrigin()}/_sites` });
}

export default async function SitePage({ params }: { params: { slug: string; rest?: string[] } }) {
  const site = await getSiteBySlug(params.slug);
  if (!site) return notFound();

  const pageSlug = params.rest?.[0] ?? firstPageSlug(site);
  const colorMode = (site.color_mode as 'light' | 'dark') ?? 'light';

  return (
    <TemplateEditorProvider
      templateName={site.template_name}
      colorMode={colorMode}
      initialData={site}
    >
      <SiteRenderer
        site={site}
        page={pageSlug}
        baseUrl={`${await getOrigin()}/_sites`}
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
      />
    </TemplateEditorProvider>
  );
}
