import { NextSeo } from 'next-seo';

export default function MetaTags({
  title = 'QuickSites',
  description = 'AI-powered local site generator and dashboard',
  image = '/assets/opengraph-image.dark.safe.png',
  url = 'https://quicksites.ai',
}) {
  return (
    <NextSeo
      title={title}
      description={description}
      canonical={url}
      openGraph={{
        url,
        title,
        description,
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
        site_name: 'QuickSites',
      }}
      twitter={{
        handle: '@quicksites_ai',
        site: '@quicksites_ai',
        cardType: 'summary_large_image',
      }}
    />
  );
}
