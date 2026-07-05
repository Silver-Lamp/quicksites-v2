// app/page.tsx — server component: SSRs the showcase data so the "Built with
// QuickSites" row is in the initial HTML for everyone (incl. unauthenticated
// users), independent of any client fetch/cache. The rest of the homepage is the
// client component HomeClient.

import HomeClient from '@/components/home/home-client';
import SiteShowcase from '@/components/home/site-showcase';
import { getShowcaseData } from '@/lib/home/getShowcaseData';
import { getResellers } from '@/lib/home/getResellers';
import { marketingOg } from '@/lib/marketingOg';

export const dynamic = 'force-dynamic';

// Homepage-scoped share metadata (kept on the page, not the org-aware root
// layout, so it only brands "/").
export const metadata = marketingOg({
  title: 'QuickSites — One-Click Local Websites',
  description:
    'Launch a professional site for your local business in minutes — AI-assisted, with built-in commerce and a partner program.',
  path: '/',
  ogTitle: 'One-Click Local Websites',
  ogSubtitle:
    'Launch a professional site for your local business in minutes — AI-assisted, with built-in commerce.',
});

export default async function Page() {
  let initial;
  try {
    const data = await getShowcaseData();
    // SSR payload is the public view — drop admin-hidden sites. Admins still get
    // the full set (incl. hidden, for management) via the client revalidation fetch.
    const visible = data.sites.filter((s) => !s.hidden);
    // Only seed the client with SSR data when we actually have sites. If the query
    // hiccuped and returned empty, passing a truthy-but-empty object would make the
    // client treat it as "loaded, just empty" and render nothing — skipping the
    // localStorage cache + /api/public/showcase fallback. Passing undefined lets the
    // client paint from cache (returning visitors) and revalidate, so a transient
    // SSR miss never blanks the row.
    initial = visible.length > 0 ? { ...data, sites: visible } : undefined;
  } catch {
    initial = undefined; // client component will fetch/cache as a fallback
  }

  // Featured reseller orgs for the reseller diagram (name/domain/accent from DB).
  const resellers = await getResellers();

  return <HomeClient showcase={<SiteShowcase initialData={initial} />} resellers={resellers} />;
}
