'use client';

import RenderBlock from '@/components/admin/templates/render-block';
import MetaHead from '@/components/head/MetaHead';
import ThemeScope from '@/components/ui/theme-scope';
import type { Template } from '@/types/template';
import type { Block } from '@/types/blocks';

type Props = {
  site: Template;
  page: string;
  baseUrl: string;
  enableThemeWrapper?: boolean;
};

export default function SiteRenderer({ site, page, baseUrl, enableThemeWrapper = false }: Props) {
  const pages = site.data?.pages || [];
  const currentPage = pages.find((p) => p.slug === page);
  if (!currentPage) return null;

  const showHeader = currentPage.show_header ?? site.show_header ?? true;
  const showFooter = currentPage.show_footer ?? site.show_footer ?? true;

  const ogImage = currentPage.meta?.ogImage || site.logo_url || 'https://quicksites.ai/og-cache/og-default.png';
  const theme = currentPage.meta?.theme || site.theme || 'dark';

  const serviceAreaBlock = currentPage.content_blocks?.find((b) => b.type === 'service_areas');
  const schemaLocalBusiness = serviceAreaBlock
    ? {
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: site.template_name,
        url: site.custom_domain
          ? `https://${site.custom_domain}`
          : `${baseUrl}/${site.slug}`,
        image: site.logo_url || undefined,
        address: {
          "@type": "PostalAddress",
          addressLocality: serviceAreaBlock.content?.city || undefined,
          addressRegion: serviceAreaBlock.content?.state || undefined,
          postalCode: serviceAreaBlock.content?.zip || undefined,
        },
        areaServed: serviceAreaBlock.content?.cities?.map((city: string) => ({
          "@type": "Place",
          name: city,
        })),
      }
    : undefined;

  const content = (
    <>
      <MetaHead
        title={currentPage.meta?.title || site.template_name || ''}
        description={currentPage.meta?.description || site.description || ''}
        ogImage={ogImage}
        faviconSizes={currentPage.meta?.faviconSizes as unknown as Partial<Record<string, string>> || {}}
        appleIcons={currentPage.meta?.appleIcons as unknown as Partial<Record<string, string>> || {}}
        customDomain={site.custom_domain}
        slug={site.slug}
        schemaLocalBusiness={schemaLocalBusiness}
      />

      <div className="min-h-screen text-white bg-black">
        {showHeader && site.headerBlock && (
          <div className="mb-8">
            <RenderBlock block={site.headerBlock} />
          </div>
        )}

        <main className="py-8 space-y-8">
          {currentPage.content_blocks?.map((block, i) => {
            const layoutMode = block.type === 'hero' ? (block.content as Block)?.layout_mode : undefined;
            const isFullBleed = block.type === 'hero' && layoutMode === 'full_bleed';

            return (
              <div
                key={block._id || i}
                className={isFullBleed ? '' : 'px-4 max-w-5xl mx-auto'}
              >
                <RenderBlock block={block} />
              </div>
            );
          })}
        </main>

        {showFooter && site.footerBlock && (
          <div className="mt-12 border-t border-white/10">
            <RenderBlock block={site.footerBlock} />
          </div>
        )}
      </div>
    </>
  );

  return enableThemeWrapper ? (
    <ThemeScope mode={theme === 'light' ? 'light' : 'dark'}>{content}</ThemeScope>
  ) : (
    content
  );
}
