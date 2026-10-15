// app/for/[code]/page.tsx
//
// The dynamic rep page: what /for-abdou is by hand, for any rep a partner mints from their
// dashboard (lib/partners/repCodes.ts). Unlisted, noindex, linked from nowhere but the partner's
// "Copy their page" button. Under the partner's brand (a strip under the site header naming the
// reseller org), the live restaurants table for the rep's city with "Build their ordering page"
// and "Text them", a sweep for anywhere else, and the rep's own link.
//
// ⚠️ The build grant is minted for THIS code only (lib/rep/repActionToken.ts), so a page copied
// to a stranger can build drafts as this rep and nothing else; the route still caps the code per
// day and builds only a parked prospect by id.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/site/site-header';
import RestaurantsSection from '@/components/for-rep/restaurants-section';
import RepHoursSection from '@/components/for-rep/rep-hours-section';
import NoSiteSection from '@/components/for-rep/no-site-section';
import { mintRepActionToken } from '@/lib/rep/repActionToken';
import { repProfile, repLinks } from '@/lib/partners/repCodes';
import { getPartnerOrg } from '@/lib/partners/whiteLabel';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const rep = await repProfile(code);
  return {
    title: rep ? `For ${rep.name}` : 'Not found',
    robots: { index: false, follow: false },
  };
}

export default async function RepPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const rep = await repProfile(code);
  if (!rep) notFound();
  const org = await getPartnerOrg(rep.ownerId);
  const token = mintRepActionToken(rep.code);
  const links = repLinks(rep.code);
  const first = rep.name.split(/\s+/)[0] || rep.name;
  const territory = rep.city ? { city: rep.city, region: rep.region ?? '', label: rep.region ? `${rep.city}, ${rep.region}` : rep.city } : null;

  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {org ? (
          <div className="border-b border-zinc-800 bg-zinc-900/60">
            <div className="mx-auto flex max-w-3xl items-center gap-3 px-6 py-2 text-xs text-zinc-400">
              {org.dark_logo_url || org.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={org.dark_logo_url || org.logo_url || ''} alt="" className="h-5 w-auto" />
              ) : null}
              <span>
                <span className="font-semibold text-zinc-200">{org.name}</span> · a partner page, built on QuickSites
              </span>
            </div>
          </div>
        ) : null}

        <section className="relative mx-auto max-w-3xl px-6 pb-8 pt-14">
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">Unlisted — just for you</span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey {first} 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            This page is yours. Below are the restaurants{territory ? ` in ${territory.label}` : ' near you'} that have a website but
            take no orders online. Build one an ordering page from the menu they already published, show it to the owner over
            lunch, and text them the link. When they take it and orders start, your code is on every one.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            Your link: <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-200">{links.refLink}</code>
          </p>
        </section>

        <RepHoursSection code={rep.code} repName={first} token={token} />
        <RestaurantsSection code={rep.code} repName={first} token={token} prominent territory={territory} />
        <NoSiteSection code={rep.code} repName={first} token={token} territory={territory} />

        <section className="mx-auto max-w-3xl px-6 pb-20 pt-8">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 text-sm leading-relaxed text-zinc-400">
            <p className="font-semibold text-zinc-200">Two rules</p>
            <p className="mt-2">
              You write the message, not us — the button only prefills a start. And never promise a thing the page cannot do:
              no ranking, no &ldquo;24/7&rdquo;, no guarantee, no price you were not given.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
