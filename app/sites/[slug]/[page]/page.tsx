// app/sites/[slug]/[page]/page.tsx
import { getSupabase } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import type { TemplateData } from '@/types/template';
import RenderBlock from '@/components/admin/templates/render-block';
import { DevToolsToggler } from '@/components/DevToolsToggler';

export default async function SitePage({ params }: { params: { slug: string; page: string } }) {
  const { slug, page } = await Promise.resolve(params); // ✅ fixes Next.js error

  const supabase = await getSupabase();

  const { data: site, error } = await supabase
    .from('templates')
    .select('data, slug')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  if (!site || error) return notFound();

  const pages = (site.data as TemplateData)?.pages || [];
  const currentPage = pages.find((p) => p.slug === page);

  if (!currentPage) return notFound();

  return (
    <div className="bg-black text-white min-h-screen">
      {/* <DevToolsToggler /> */}
      <div className="py-8 px-4 max-w-5xl mx-auto">
        {/* <h2 className="text-3xl font-bold mb-6">{currentPage.title}</h2> */}
        {currentPage.content_blocks?.map((block, i) => (
          <div key={block._id || i} className="mb-8">
            <RenderBlock block={block} />
          </div>
        ))}
      </div>
    </div>
  );
}
