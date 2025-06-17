// ✅ FILE: pages/about.tsx (uses usePageSeo)

import { NextSeo } from 'next-seo';
import { usePageSeo } from '@/lib/usePageSeo';

export default function AboutPage() {
  const seo = usePageSeo({
    description: 'Learn more about the QuickSites team and mission.',
  });

  return (
    <>
      <NextSeo {...seo} />

      <main className="p-6">
        <h1 className="text-3xl font-bold mb-4">About Us</h1>
        <p className="text-gray-300">
          QuickSites is an AI-powered platform helping local businesses get
          online fast with beautiful, optimized sites.
        </p>
      </main>
    </>
  );
}
