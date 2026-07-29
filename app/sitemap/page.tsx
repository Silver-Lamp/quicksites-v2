// app/sitemap/page.tsx
//
// The HUMAN sitemap. Same SiteMapExplorer the 404 uses, so the map has one source and the two
// can never drift apart (mesh advisory, crosstalk 20260727-015522).
//
// Distinct from /sitemap.xml, which already exists and serves crawlers. This one is grouped,
// searchable, and written for a person — and unlike the 404 it IS indexable, because a public
// index of every front door is a legitimate page in its own right.
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import SiteMapExplorer from '@/components/site/sitemap-explorer';

export const metadata: Metadata = {
  title: 'Sitemap — every page on QuickSites',
  description:
    'Every public page on QuickSites, grouped and searchable: build a site, compare builders, partner earnings, local business directories, and gigs.',
  robots: { index: true, follow: true },
};

export default function SitemapPage() {
  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="mx-auto max-w-5xl px-6 py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Sitemap</h1>
          <p className="mt-3 max-w-xl text-zinc-400">
            Everything on QuickSites, in one place. Search it or browse the groups.
          </p>
          <div className="mt-8">
            {/* Autofocused here but NOT on the 404: someone who arrived at /sitemap came to
                look something up, whereas someone who hit a 404 should read what happened
                before the cursor jumps into a box. */}
            <SiteMapExplorer autoFocus />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
