'use server';

import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import SiteRenderer from '@/components/sites/site-renderer';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { getSiteBySlug } from '@/lib/templates/getSiteBySlug';
import { TemplateEditorProvider } from '@/context/template-editor-context';

export async function generateMetadata({
  params,
}: { params: { slug: string } }): Promise<Metadata> {
  const site = await getSiteBySlug(params.slug);
  if (!site) return {};
  // No page slug in this route — let metadata helper pick first page
  return generatePageMetadata({
    site,
    pageSlug: 'home',
    baseUrl: 'https://quicksites.ai/_sites',
  });
}

export default async function SitePage({ params }: { params: { slug: string } }) {
  const site = await getSiteBySlug(params.slug);
  if (!site) return notFound();

  const colorMode = (site.color_mode as 'light' | 'dark') ?? 'light';

  return (
    <TemplateEditorProvider
      templateName={site.template_name}
      colorMode={colorMode}
      initialData={site}
    >
      <SiteRenderer
        site={site}
        // no page slug in this route; defaults to first page
        baseUrl="https://quicksites.ai/_sites"
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
      />
    </TemplateEditorProvider>
  );
}
