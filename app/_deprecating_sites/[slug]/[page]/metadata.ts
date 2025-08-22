import type { Metadata } from 'next';
import { getServerSupabase } from '@/lib/supabase/server';
import type { TemplateData } from '@/types/template';

export async function generateMetadata({ params }: { params: { slug: string; page: string } }): Promise<Metadata> {
  const { slug, page } = params;
  const supabase = await getServerSupabase();

  const { data: site } = await supabase
    .from('templates')
    .select('*')
    .eq('slug', slug)
    .eq('is_site', true)
    .maybeSingle();

  const pages = (site?.data as TemplateData)?.pages || [];
  const currentPage = pages.find((p) => p.slug === page);

  const title = currentPage?.meta?.title || currentPage?.title || site?.template_name;
  const description = currentPage?.meta?.description || site?.description || 'Built with QuickSites.';
  const ogImage = `https://quicksites.ai/storage/v1/object/public/og-cache/og-${slug}-${page}.png`;

  const favicons = {
    '16': `/storage/v1/object/public/favicons/${site.id}/favicon-16x16.png`,
    '32': `/storage/v1/object/public/favicons/${site.id}/favicon-32x32.png`,
    '48': `/storage/v1/object/public/favicons/${site.id}/favicon-48x48.png`,
    '64': `/storage/v1/object/public/favicons/${site.id}/favicon-64x64.png`,
  };

  const appleIcons = {
    '180': `/storage/v1/object/public/favicons/${site.id}/favicon-64x64.png`,
  };

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `https://quicksites.ai/sites/${slug}/${page}`,
      images: [ogImage],
    },
    icons: {
      icon: favicons['32'],
      apple: appleIcons['180'],
    },
    other: {
      __head_links: [
        ...Object.entries(favicons).map(
          ([size, url]) => `<link rel="icon" type="image/png" sizes="${size}x${size}" href="${url}">`
        ),
        ...Object.entries(appleIcons).map(
          ([size, url]) => `<link rel="apple-touch-icon" sizes="${size}x${size}" href="${url}">`
        ),
      ].join('\n'),
    },
  };
}
