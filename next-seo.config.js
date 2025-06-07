const title = 'QuickSites';
const description = 'AI-powered local site generator and dashboard';

export default {
  title,
  description,
  canonical: 'https://quicksites.ai',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://quicksites.ai',
    site_name: 'QuickSites',
    title,
    description,
    images: [
      {
        url: '/assets/opengraph-image.dark.safe.png',
        width: 1200,
        height: 630,
        alt: title,
      },
    ],
  },
  twitter: {
    handle: '@quicksites_ai',
    site: '@quicksites_ai',
    cardType: 'summary_large_image',
  },
};
