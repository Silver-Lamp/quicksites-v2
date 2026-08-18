// app/list-your-sale/sitemap.ts
//
// A real sitemap for the yardsalesites.com brand host.
//
// ⚠️ FIXES A LIVE BUG, not just an omission. `robots.txt` advertises
// `https://<host>/sitemap.xml` on EVERY host, and on yardsalesites.com that URL returned 404 —
// the custom `/sitemap.xml/[domain]` route serves published TENANT sites, and the brand host is
// not one. So the host was telling crawlers where its sitemap lived and handing them nothing.
// A sitemap that 404s is worse than none: it spends crawl budget and teaches the crawler to stop
// asking. (The `[domain]` route's own header describes this exact failure on another host.)
//
// Next's convention serves this at /list-your-sale/sitemap.xml. It is a *segment* sitemap rather
// than a root one because the root path is already taken by the custom tenant route — so
// robots.txt still needs to learn about it, which it does not yet. Noted rather than hidden:
// until robots points here, these URLs are discovered through internal links only.
import type { MetadataRoute } from 'next';
import { YARD_SALE_CITIES } from '@/lib/yardSale/cities';

const BASE = 'https://yardsalesites.com';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/yard-sale/new`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    ...YARD_SALE_CITIES.map((c) => ({
      url: `${BASE}/list-your-sale/${c.slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      // Below the front door on purpose: these are a supporting surface, not the product.
      priority: 0.7,
    })),
  ];
}
