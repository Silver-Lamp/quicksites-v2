import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import SiteRenderer from '@/components/sites/site-renderer';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { getSiteBySlug } from '@/lib/templates/getSiteBySlug';
import { getSiteByDomain } from '@/lib/templates/getSiteByDomain'; // add below

async function origin() {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function resolveSite(domain: string) {
  // 1) Exact domain mapping
  let site = await getSiteByDomain(domain);
  if (site) return site;

  // 2) Fallback: try second-level name as slug (e.g., graftontowing.com → graftontowing)
  const maybeSlug = domain.split('.').slice(0, -1).join('.');
  if (maybeSlug) site = await getSiteBySlug(maybeSlug);
  return site;
}

export async function generateMetadata({ params }: { params: { domain: string } }) {
  const site = await resolveSite(params.domain.toLowerCase());
  if (!site) return {};
  return generatePageMetadata({
    site,
    pageSlug: 'home',
    baseUrl: `${origin()}/_sites`,
  });
}

export default async function DomainRouterPage({ params }: { params: { domain: string; rest?: string[] } }) {
  const site = await resolveSite(params.domain.toLowerCase());
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
        baseUrl={`${origin()}/_sites`}   // ✅ use current host, not quicksites.ai
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
      />
    </TemplateEditorProvider>
  );
}
