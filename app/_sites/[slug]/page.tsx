// app/_sites/[slug]/page.tsx
'use server';

import { getSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { TemplateData, Template } from '@/types/template';
import RenderBlock from '@/components/admin/templates/render-block';
import { Metadata } from 'next';
import MetaHead from '@/components/head/MetaHead';

export const generateMetadata = async ({ params }: { params: { slug: string; page: string } }): Promise<Metadata> => {
  const { slug, page } = params;
  const supabase = await getSupabase();
  const { data: site } = await supabase
    .from('templates')
    .select('data, template_name, description, slug')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  const pages = (site?.data as TemplateData)?.pages || [];
  const currentPage = pages.find((p) => p.slug === page);

  return {
    title: `${currentPage?.title || site?.template_name} | QuickSites`,
    description: currentPage?.meta?.description || site?.description || 'A professional QuickSites website.',
    openGraph: {
      title: currentPage?.title || site?.template_name,
      description: currentPage?.meta?.description || site?.description,
      url: `https://quicksites.ai/${slug}/${page}`,
    },
  };
};

export default async function SitePage({ params }: { params: { slug: string; page: string } }) {
  const { slug, page } = await Promise.resolve(params);
  const supabase = await getSupabase();

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

  // 🧠 Use template-level fallback for header/footer visibility
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

      <div className="bg-black text-white min-h-screen">
        {showHeader && site.headerBlock && (
          <div className="mb-8">
            <RenderBlock block={site.headerBlock} />
          </div>
        )}

        <main className="py-8 space-y-8">
          {currentPage.content_blocks?.map((block, i) => (
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
          ))}
        </main>

        {showFooter && site.footerBlock && (
          <div className="mt-12 border-t border-white/10">
            <RenderBlock block={site.footerBlock} />
          </div>
        )}
      </div>
    </>
  );
}
