// app/page.tsx — server component: SSRs the showcase data so the "Built with
// QuickSites" row is in the initial HTML for everyone (incl. unauthenticated
// users), independent of any client fetch/cache. The rest of the homepage is the
// client component HomeClient.

import HomeClient from '@/components/home/home-client';
import SiteShowcase from '@/components/home/site-showcase';
import { getShowcaseData } from '@/lib/home/getShowcaseData';

export const dynamic = 'force-dynamic';

export default async function Page() {
  let initial;
  try {
    const data = await getShowcaseData();
    // SSR payload is the public view — drop admin-hidden sites. Admins still get
    // the full set (incl. hidden, for management) via the client revalidation fetch.
    initial = { ...data, sites: data.sites.filter((s) => !s.hidden) };
  } catch {
    initial = undefined; // client component will fetch/cache as a fallback
  }
  return <HomeClient showcase={<SiteShowcase initialData={initial} />} />;
}
