// ✅ FILE: lib/seo.ts

export function getPageSeo({
  title,
  description,
  slug,
}: {
  title: string;
  description: string;
  slug: string;
}) {
  return {
    title: `${title} | QuickSites`,
    description,
    openGraph: {
      title,
      description,
      url: `https://quicksites.ai${slug}`,
    },
    twitter: {
      cardType: 'summary_large_image',
    },
  };
}
