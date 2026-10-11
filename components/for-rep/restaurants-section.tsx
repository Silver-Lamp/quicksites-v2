// components/for-rep/restaurants-section.tsx
//
// "Walk in, have lunch, drop a card, earn residuals for life." — the restaurants section every
// sales-related /for-<name> page carries: the swept restaurants of the rep's territory grouped by
// online ordering (call first / offer a site only / leave alone), the table with build buttons
// and the postcard, and the "sweep where you are" widget for anywhere else. A page with no
// territory gets the widget alone, and fills in from the rep's first sweep.
//
// Server component (reads the database). Copy is held to the claim-postcard forbidden list by
// components/for-rep/__tests__/restaurantsSection.test.ts — a rep page is where a promise would be
// most tempting and least checkable.
import Link from 'next/link';
import { loadRestaurantsFor } from '@/lib/rep/repRestaurants';
import { territoryFor } from '@/lib/rep/territories';
import { breakEvenOrders } from '@/lib/compare/toast';
import RestaurantTable from '@/components/for-rep/restaurant-table';
import SweepHere from '@/components/for-rep/sweep-here';

export const SECTION_COPY = {
  kicker: 'Restaurants',
  title: 'Walk in, have lunch, drop a card, earn residuals for life.',
  intro: (place: string | null) =>
    place
      ? `Most restaurants in ${place} already have a website. The question that decides the pitch is whether they take orders online, and through whom — read from each restaurant's own site. The ones below with a site and no online ordering are the ones to have lunch at.`
      : 'Most restaurants already have a website. The question that decides the pitch is whether they take orders online, and through whom — read from each restaurant\'s own site. Sweep the town you are standing in and the ones to have lunch at appear below.',
  howTitle: 'The whole method, in four moves',
  how: [
    'Press Build their ordering page before you go in — it reads the menu they already published, so you walk in with their dishes, not a guess.',
    'Have lunch. Show the owner the Evolve page on your phone: their site beside the ordering page, and a dish they can tap.',
    'Leave the postcard on the counter if the owner is out — its QR opens the same page and carries your code.',
    'When they take it and orders start, your share of every order is paid for as long as they sell. You earn when they do, and only then.',
  ],
  cards: {
    call: { title: 'Call first', body: 'A site, but no online ordering found — or a shop that ships beans and gifts but takes no food order, or orders only through a delivery app that takes a cut. Here the no-monthly fee has nothing to beat.' },
    siteOnly: { title: 'Offer a site, not the ordering', body: 'Their only web presence is a Toast or Square ordering page. Build them a site that links to it — you are giving the name a home, not asking them to change how they take orders. Never pitch that first.' },
    leaveAlone: (breakEven: number) => ({ title: 'Leave alone', body: `On Toast or Square with a site of their own. Nothing to offer today. If one asks, the honest comparison is at quicksites.ai/compare/toast — above about ${breakEven} online orders a month Toast costs them less, and it says so.` }),
  },
  footnote: 'The ordering page is built from their own site and is theirs to claim; the text message says their website stays as it is. "Not checked" means nobody has read that site yet, not that it takes no orders.',
  elsewhere: 'Somewhere else today?',
} as const;

export default async function RestaurantsSection({ code, repName, token, prominent = false }: { code: string | null; repName: string; token: string | null; /** The main event: a larger title, placed right under the page's opening. */ prominent?: boolean }) {
  const territory = territoryFor(code);
  const menuHost = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null;
  const data = territory ? await loadRestaurantsFor({ city: territory.city, region: territory.region, code, menuHost }) : null;
  const place = territory?.label ?? null;
  const readOn = data?.checkedOn ? new Date(data.checkedOn).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : null;
  const breakEven = breakEvenOrders(2000) ?? 0;
  const c = SECTION_COPY;

  return (
    <section className={`mx-auto max-w-3xl px-6 pb-4 ${prominent ? 'pt-4' : 'pt-8'}`}>
      <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">{c.kicker}</h2>
      <h3 className={`mt-2 font-bold text-white ${prominent ? 'text-2xl md:text-3xl' : 'text-xl'}`}>{c.title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-zinc-400">
        {c.intro(place)}
        {readOn ? ` Sites last read ${readOn}.` : ''}
      </p>

      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <h4 className="text-sm font-semibold text-white">{c.howTitle}</h4>
        <ol className="mt-2 space-y-1.5 text-sm text-zinc-400">
          {c.how.map((step, i) => (
            <li key={step} className="flex gap-2">
              <span className="shrink-0 text-emerald-400">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {data && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.05] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">{c.cards.call.title}</h4>
                <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">{data.counts.call + data.counts.shop + data.counts.thirdParty}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{c.cards.call.body}</p>
            </div>
            <div className="rounded-xl border border-sky-500/25 bg-sky-500/[0.04] p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">{c.cards.siteOnly.title}</h4>
                <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-300">{data.counts.siteOnly}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">{c.cards.siteOnly.body}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h4 className="text-sm font-semibold text-white">{c.cards.leaveAlone(breakEven).title}</h4>
                <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-300">{data.counts.leaveAlone}</span>
              </div>
              <p className="mt-2 text-sm text-zinc-400">
                {c.cards.leaveAlone(breakEven).body.split('quicksites.ai/compare/toast')[0]}
                <Link href="/compare/toast" className="text-sky-400 underline underline-offset-4">quicksites.ai/compare/toast</Link>
                {c.cards.leaveAlone(breakEven).body.split('quicksites.ai/compare/toast')[1]}
              </p>
            </div>
          </div>
          {data.rows.length > 0 ? (
            <RestaurantTable rows={data.rows} token={token ?? ''} repName={repName} readOnly={!token} />
          ) : (
            <p className="mt-4 text-sm text-zinc-400">Nobody has swept {place} for restaurants yet — press the button below and it fills in.</p>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            {c.footnote}{data.counts.unchecked ? ` ${data.counts.unchecked} still to check.` : ''}
          </p>
        </>
      )}

      <h4 className="mt-6 text-sm font-semibold text-white">{c.elsewhere}</h4>
      <SweepHere code={code} token={token} repName={repName} initialCity={territory ? '' : undefined} />
    </section>
  );
}
