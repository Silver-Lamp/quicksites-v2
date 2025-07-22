// app/sites/[slug]/[page]/page.tsx
'use server';

import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { TemplateData, Template } from '@/types/template';
import RenderBlock from '@/components/admin/templates/render-block';
import ThemeScope from '@/components/ui/theme-scope';
import { Metadata } from 'next';
import MetaHead from '@/components/head/MetaHead';

export async function generateMetadata({ params }: { params: { slug: string; page: string } }): Promise<Metadata> {
  const { slug, page } = await Promise.resolve(params);
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: site } = await supabase
    .from('templates')
    .select('template_name, description, logo_url, data')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  const pages = (site?.data as TemplateData)?.pages || [];
  const currentPage = pages.find((p) => p.slug === page);

  const ogImage = `https://quicksites.ai/storage/v1/object/public/og-cache/og-${slug}-${page}.png`;

  return {
    title: currentPage?.meta?.title || `${currentPage?.title || site?.template_name}`,
    description: currentPage?.meta?.description || site?.description || 'A site built with QuickSites.',
    icons: {
      icon: site?.logo_url || '/favicon.ico',
    },
    openGraph: {
      title: currentPage?.meta?.title || site?.template_name,
      description: currentPage?.meta?.description || site?.description,
      url: `https://quicksites.ai/sites/${slug}/${page}`,
      images: [ogImage],
    },
  };
}

export default async function SitePage({ params }: { params: { slug: string; page: string } }) {
  const { slug, page } = await Promise.resolve(params);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: site, error } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site || error) return notFound();

  const pages = (site.data as TemplateData)?.pages || [];
  const currentPage = pages.find((p) => p.slug === page);
  if (!currentPage) return notFound();

  const theme = currentPage.meta?.theme || site.theme || 'dark';

  // 🔁 Template-wide header/footer fallback logic
  const showHeader = currentPage.show_header ?? site.show_header ?? true;
  const showFooter = currentPage.show_footer ?? site.show_footer ?? true;

  return (
    <>
      <MetaHead
        title={currentPage.meta?.title || site.template_name || ''}
        description={currentPage.meta?.description || site.description || ''}
        ogImage={currentPage.meta?.ogImage || site.logo_url || 'https://quicksites.ai/og-cache/og-default.png'}
        faviconSizes={currentPage.meta?.faviconSizes || site.logo_url || 'https://quicksites.ai/og-cache/og-default.png'}
        appleIcons={currentPage.meta?.appleIcons || site.logo_url || 'https://quicksites.ai/og-cache/og-default.png'}
      />
      <ThemeScope mode={theme === 'light' ? 'light' : 'dark'}>
        <div className="min-h-screen text-white">
          {showHeader && site.headerBlock && (
            <div className="mb-8">
              <RenderBlock block={site.headerBlock} />
            </div>
          )}

          <main className="">
            {currentPage.content_blocks?.map((block, i) => (
              block.type === 'header' && (
                <div key={block._id || i}>
                  <RenderBlock block={block} />
                </div>
              )
            ))}
          </main>
          <main className="py-8 space-y-8">
            {currentPage.content_blocks?.map((block, i) => (
              block.type !== 'header' && block.type !== 'footer' && (
                <div
                key={block._id || i}
                className={
                  block.type === 'hero' && block.content?.layout_mode === 'full_bleed'
                    ? ''
                    : 'px-4 max-w-5xl mx-auto'
                }
              >
                <RenderBlock block={block} />
              </div>
              )
            ))}
          </main>
          <main className="">
            {currentPage.content_blocks?.map((block, i) => (
              block.type === 'footer' && (
                <div key={block._id || i}>
                  <RenderBlock block={block} />
                </div>
              )
            ))}
          </main>

          {/* {showFooter && site.footerBlock && (
            <div className="mt-12">
              <RenderBlock block={site.footerBlock} />
            </div>
          )} */}
        </div>
      </ThemeScope>
    </>
  );
}
