// app/_domains/[domain]/[[...rest]]/page.tsx
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import SiteRenderer from '@/components/sites/site-renderer';
import { generatePageMetadata } from '@/lib/seo/generateMetadata';
import { getSiteBySlug } from '@/lib/templates/getSiteBySlug';
import { getSiteByDomain } from '@/lib/templates/getSiteByDomain';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// ---------- helpers ----------
function stripWww(d: string) {
  const x = (d || '').toLowerCase().replace(/\.$/, '');
  return x.startsWith('www.') ? x.slice(4) : x;
}
function apexLabelOf(d: string) {
  const apex = stripWww(d);
  const parts = apex.split('.');
  return parts.length > 1 ? parts.slice(0, -1).join('.') : parts[0];
}
function variantsForDomain(domain: string): string[] {
  const d = (domain || '').toLowerCase().replace(/\.$/, '');
  const apex = stripWww(d);
  return Array.from(new Set([d, apex, `www.${apex}`]));
}
// -----------------------------

async function origin() {
  const h = await headers();
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000')
    .toLowerCase()
    .replace(/\.$/, '');
  const proto = h.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function resolveSite(domain: string) {
  // 1) Prefer slug from apex label (e.g., graftontowing.com -> graftontowing)
  const slug = apexLabelOf(domain);
  if (slug) {
    const bySlug = await getSiteBySlug(slug);
    if (bySlug) return bySlug;
  }

  // 2) Fall back to domain lookups with normalized variants
  for (const candidate of variantsForDomain(domain)) {
    const byDomain = await getSiteByDomain(candidate);
    if (byDomain) return byDomain;
  }

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: { domain: string; rest?: string[] };
}): Promise<Metadata> {
  const site = await resolveSite(params.domain);
  if (!site) return {};
  const pageSlug = params.rest?.[0] ?? 'home';
  const baseUrl = `${await origin()}/sites`;
  return generatePageMetadata({ site, pageSlug, baseUrl });
}

export default async function DomainRouterPage({
  params,
}: {
  params: { domain: string; rest?: string[] };
}) {
  const site = await resolveSite(params.domain);
  if (!site) return notFound();

  const colorMode = (site.color_mode as 'light' | 'dark') ?? 'light';
  const baseUrl = `${await origin()}/sites`;
  const pageSlug = params.rest?.[0] ?? 'home';

  return (
    <TemplateEditorProvider
      templateName={site.template_name ?? site.slug ?? String(site.id)}
      colorMode={colorMode}
      initialData={site}
    >
      <SiteRenderer
        site={site}
        page={pageSlug}
        baseUrl={baseUrl}
        id="site-renderer-page"
        colorMode={colorMode}
        className="bg-white text-black dark:bg-black dark:text-white"
      />
    </TemplateEditorProvider>
  );
}
