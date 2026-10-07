// app/page.tsx — server component: SSRs the showcase data so the "Built with
// QuickSites" row is in the initial HTML for everyone (incl. unauthenticated
// users), independent of any client fetch/cache. The rest of the homepage is the
// client component HomeClient.

import { Suspense } from 'react';
import { organizationSchemaJson } from '@/lib/seo/organizationSchema';
import { cache } from 'react';
import HomeClient from '@/components/home/home-client';
import SiteShowcase from '@/components/home/site-showcase';
import SiteFlyThrough, { FLY_COUNT } from '@/components/home/site-fly-through';
import { getShowcaseData } from '@/lib/home/getShowcaseData';
import { marketingOg } from '@/lib/marketingOg';

export const dynamic = 'force-dynamic';

// Homepage-scoped share metadata (kept on the page, not the org-aware root
// layout, so it only brands "/").
export const metadata = marketingOg({
  title: 'QuickSites — One-Click Local Websites',
  description:
    'Launch a professional site for your local business in minutes — AI-assisted, with built-in commerce.',
  path: '/',
  ogTitle: 'One-Click Local Websites',
  ogSubtitle:
    'Launch a professional site for your local business in minutes — AI-assisted, with built-in commerce.',
});

// SSR the showcase inside a Suspense boundary so the homepage SHELL (hero) streams
// immediately instead of blocking on ~5 sequential DB round-trips. The fallback is
// the client SiteShowcase (paints from localStorage cache + /api/public/showcase),
// so returning visitors see the row instantly and it upgrades to SSR data when ready.
// ⚠️ One DB read per request for both consumers below. React's cache() memoises the call across
// server components in the same render, so the fly-through does not add a second ~5-query trip.
const showcaseOnce = cache(getShowcaseData);

/** The first five visible showcase sites, flying behind the hero (see site-fly-through.tsx). */
async function FlyThroughSSR() {
  try {
    const data = await showcaseOnce();
    const five = data.sites.filter((s) => !s.hidden).slice(0, FLY_COUNT);
    return <SiteFlyThrough sites={five.map((s) => ({ slug: s.slug, name: s.name, industry: s.industry }))} />;
  } catch {
    return null;
  }
}

async function ShowcaseSSR() {
  let initial;
  try {
    const data = await showcaseOnce();
    const visible = data.sites.filter((s) => !s.hidden);
    initial = visible.length > 0 ? { ...data, sites: visible } : undefined;
  } catch {
    initial = undefined;
  }
  return <SiteShowcase initialData={initial} />;
}

export default function Page() {
  return (
    <>
      {/*
        Organization JSON-LD — the entity record for a branded-query ranking problem.
        Search Console shows average position 12.3 for "quicksites", our OWN name, on 663
        impressions. Server-rendered here (not injected client-side) so a crawler sees it in the
        first response; the homepage already SSRs ~8k characters, so this joins content that is
        genuinely there rather than propping up an empty shell.
        See lib/seo/organizationSchema.ts for the full diagnosis and its limits.
      */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationSchemaJson() }}
      />
    <HomeClient
      heroLayer={
        <Suspense fallback={null}>
          <FlyThroughSSR />
        </Suspense>
      }
      showcase={
        <Suspense fallback={<SiteShowcase initialData={undefined} />}>
          <ShowcaseSSR />
        </Suspense>
      }
    />
    </>
  );
}
