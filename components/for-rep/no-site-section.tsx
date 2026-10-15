// components/for-rep/no-site-section.tsx (server)
//
// The two things a rep with a territory walks with: the LIVE list of that city's businesses
// Google shows with no website (one tap builds each a draft, every link carrying the rep's code)
// and the printable starter kit. Lifted from /for-abdou and /for-craig so every rep page carries
// the same thing (owner, 2026-10-14: "make sure they all have the latest capabilities"). With no
// territory the list is skipped and only the kit is offered.
import Link from 'next/link';
import { loadCityNoSite, streetOf, tradeLabel } from '@/lib/rep/islandNoSite';
import { repBuildLinks } from '@/lib/rep/repBuild';
import type { RepTerritory } from '@/lib/rep/territories';
import NoSiteTable, { type NoSiteRow } from '@/components/for-rep/no-site-table';

export default async function NoSiteSection({ code, repName, token, territory }: { code: string; repName: string; token: string; territory: RepTerritory | null }) {
  const kitHref = territory
    ? `/starter-kit/${code}?city=${encodeURIComponent(territory.city)}&region=${encodeURIComponent(territory.region)}&territory=${encodeURIComponent(territory.label)}`
    : `/starter-kit/${code}`;
  const island = territory ? await loadCityNoSite(territory.city, territory.region) : null;
  const menuHost = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null;
  const rows: NoSiteRow[] = (island?.rows ?? []).map((r) => {
    const slug = r.templates?.slug ?? null;
    const links = slug ? repBuildLinks({ slug, industryKey: r.industry_key, prospectId: r.id, code, menuHost }) : null;
    return {
      prospectId: r.id,
      businessName: (r.business_name ?? '').trim(),
      trade: tradeLabel(r.industry_key),
      phone: r.phone,
      street: streetOf(r.address, territory?.city ?? ''),
      rating: r.rating,
      reviewCount: r.review_count,
      previewUrl: links?.previewUrl ?? null,
      claimUrl: links?.claimUrl ?? null,
    };
  });
  const sweptLabel = island?.sweptOn ? new Date(island.sweptOn).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : null;

  return (
    <>
      {territory && (
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            {territory.label} businesses with no website{rows.length ? ` — ${rows.length} of them` : ''}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {sweptLabel ? (
              <>Pulled from Google&apos;s own listings on {sweptLabel}: every business in {territory.label} that Google shows with a phone number and no website. </>
            ) : (
              <>{territory.label} hasn&apos;t been swept yet; this fills in automatically when it is. </>
            )}
            <span className="text-zinc-200">Press <em>Build their site</em> before you go in and you have something to show on your phone.</span>
          </p>
          {rows.length > 0 && (
            <div className="lg:-mx-32 xl:-mx-56">
              <NoSiteTable rows={rows} token={token} repName={repName} />
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            A listing here means Google shows no website for them today. Some will have a Facebook page or a site Google hasn&apos;t linked. Building takes
            about twenty seconds and costs nothing; every link it hands you carries your code.
          </p>
        </section>
      )}
      <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div>
            <h3 className="text-base font-semibold text-white">Your starter kit</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Business cards, a leave-behind flyer{territory ? ', and a "your website is ready" sheet for each business we have already built a site for' : ''} — every QR code carries your code. Type your phone on that page before you print.
            </p>
          </div>
          <Link href={kitHref} className="shrink-0 rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800">
            Print my starter kit →
          </Link>
        </div>
      </section>
    </>
  );
}
