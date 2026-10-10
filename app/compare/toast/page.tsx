// app/compare/toast/page.tsx
//
// QuickSites vs Toast — for online ordering only. A static route, deliberately outside the
// generated /compare/[slug] pages: Toast is not a website builder and does not fit that feature
// matrix (AI site build, reseller residuals…), and forcing it in would mark it "no" on rows it
// was never trying to win. This page compares the one thing we overlap on.
//
// Written for the restaurant that takes NO online orders today — that is where the no-monthly
// fee is a real win. A restaurant already on Toast's point-of-sale is told, in the first screen,
// to keep it. Every figure is read from lib/compare/toast.ts; the test fails on a typed one.
//
// ⚠️ Both search phrasings ("toast alternative", "quicksites vs toast") in the metadata, each as
// ONE text node in the body — the lesson from the [slug] pages (alternativePhrasing.test.ts).

import { Fragment } from 'react';
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import SiteFooter from '@/components/site/site-footer';
import { marketingOg } from '@/lib/marketingOg';
import {
  TOAST,
  TOAST_PRICES_VERIFIED,
  QUICKSITES_RESTAURANT,
  quicksitesMonthlyCents,
  toastMonthly,
  breakEvenOrders,
  TICKETS_CENTS,
  VOLUMES,
  dollars,
  pct,
} from '@/lib/compare/toast';

export const metadata: Metadata = marketingOg({
  title: 'Toast alternative — QuickSites vs Toast for online ordering: costs by volume, honestly',
  description:
    'Looking for a Toast alternative for online ordering? Toast is a full restaurant POS; QuickSites is an ordering site with no monthly fee. Here is what each costs per month at real order volumes, where the answer flips, and when you should keep Toast.',
  path: '/compare/toast',
  ogEyebrow: 'Compare',
  ogTitle: 'QuickSites vs Toast',
  ogSubtitle: 'Online ordering costs by volume — and when to keep Toast.',
});

const keepPct = pct(1 - QUICKSITES_RESTAURANT.feePercent);
const feePct = pct(QUICKSITES_RESTAURANT.feePercent);
const floor = `${QUICKSITES_RESTAURANT.feeMinCents}¢`;
const readOn = new Date(TOAST_PRICES_VERIFIED + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

function Panel({ title, items, tone }: { title: string; items: string[]; tone: 'good' | 'us' }) {
  const icon = tone === 'us' ? '✓' : '★';
  const iconClass = tone === 'us' ? 'text-emerald-400' : 'text-amber-400';
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-2 text-sm text-zinc-300">
            <span aria-hidden className={`mt-0.5 shrink-0 ${iconClass}`}>{icon}</span>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function CompareToastPage() {
  const r = TOAST.reported;
  const p = TOAST.published;

  const strengths = [
    'One vendor for the whole restaurant: terminals, kitchen display, handhelds, payroll, and online ordering that posts straight to the kitchen.',
    'Online orders land in the same system as walk-in orders — no second tablet, no re-keying.',
    'Delivery dispatch and a loyalty programme exist as add-ons when you want them.',
    `A ${dollars(p.starterMonthly * 100)}-a-month entry plan, so the software line can start at zero.`,
  ];
  const ours = [
    `No monthly, no contract, no hardware. You pay ${feePct} of each online order (at least ${floor}), and card processing is inside that number, not on top of it.`,
    'Nothing to install. The ordering page is built from the menu you already have, and you confirm the prices before it goes live.',
    'Orders are pickup or call-ahead by default; you are never asked to run a delivery fleet.',
    'If you sell nothing online in a month, you pay nothing that month.',
  ];
  const pickThem = [
    'You already run Toast at the counter. Keep it — adding a second ordering system to save a few dollars a month is more work than it is worth.',
    `You take more online orders a month than the break-even below. Past that point Toast’s lower per-order rate wins even after its fixed costs.`,
    'You want delivery dispatch, loyalty, and reporting in one place.',
  ];
  const pickUs = [
    'You take no online orders today and want to start without a monthly bill or a multi-year commitment.',
    'Your online volume is small or seasonal, so a percentage with no fixed cost beats a subscription.',
    'You want a website with ordering on it, not a point-of-sale — your counter stays however it is.',
  ];

  return (
    <>
      <SiteHeader sticky />
      <main className="min-h-screen bg-zinc-950 text-white">
        <section className="mx-auto max-w-4xl px-6 pt-14 pb-8 text-center">
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            Compare · online ordering
          </span>
          <h1 className="mt-5 text-3xl font-extrabold tracking-tight md:text-5xl">
            QuickSites <span className="text-zinc-500">vs</span> {TOAST.name}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-base text-zinc-300">
            Looking for a <span className="font-semibold text-white">{`${TOAST.name} alternative`}</span> for
            online ordering? Here is the honest version — including the volume at which you should keep Toast.
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">{TOAST.oneLiner}</p>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-400">
            <span className="font-semibold text-zinc-200">The short version:</span> these are different products.
            Toast is a {TOAST.category}. QuickSites is a website with ordering on it and no point-of-sale at all.
            They overlap on exactly one thing — taking an order from a phone — so that is the only thing this page
            compares. <span className="text-zinc-200">If Toast already runs your counter, keep it.</span> This page is
            for the restaurant that takes no online orders today.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/rebuild" className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">
              See your menu as an ordering site — free
            </Link>
            <Link href="/compare" className="rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-300 transition hover:bg-zinc-800">
              All comparisons
            </Link>
          </div>
        </section>

        {/* Pricing snapshot — two classes of Toast figure, kept apart */}
        <section className="mx-auto max-w-4xl px-6 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300">QuickSites</div>
              <div className="mt-1 text-lg font-bold">
                {feePct} per online order, no monthly
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                You keep {keepPct} of every order. A floor of {floor} on very small tickets. Card processing is included
                in the fee. No contract, no hardware, nothing to install.
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{TOAST.name} — published</div>
              <div className="mt-1 text-lg font-bold">
                {dollars(p.starterMonthly * 100)} to {dollars(p.posMonthly * 100)} a month, plus hardware
              </div>
              <p className="mt-1 text-sm text-zinc-400">
                Starter at {dollars(p.starterMonthly * 100)}/mo; Point of Sale at {dollars(p.posMonthly * 100)}/mo; a bundle at{' '}
                {dollars(p.bundleMonthly * 100)}/mo plus {dollars(p.bundlePerEmployee * 100)} per employee. {p.upfront}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-300">
              {TOAST.name} — reported by third-party guides, not published by Toast
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Toast’s pricing page does not publish its card-processing rate, the price of the online-ordering add-on,
              or the per-order fee charged to the guest. The figures below are what independent guides report as of{' '}
              {readOn}; treat them as a starting point and ask Toast for your actual quote.
            </p>
            <ul className="mt-3 grid gap-2 text-sm text-zinc-300 sm:grid-cols-2">
              <li>Online orders: {pct(r.onlinePct)} + {r.onlineCents}¢ each</li>
              <li>In person: {pct(r.cardPresentPct)} + {r.cardPresentCents}¢ (Starter {pct(r.cardPresentStarterPct)} + {r.cardPresentCents}¢)</li>
              <li>Online-ordering add-on: about {dollars(r.onlineOrderingAddonMonthly * 100)}/mo</li>
              <li>Guest fee on each online order: {r.guestFeeCentsLow}¢ to {r.guestFeeCentsHigh}¢, paid by the guest</li>
              <li>Contract: {r.contractYears} years, per the guides</li>
            </ul>
          </div>
        </section>

        {/* The honest table: cost per month by volume, and where it flips */}
        <section className="mx-auto max-w-4xl px-6 py-8">
          <h2 className="text-2xl font-semibold">What each costs the restaurant per month</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Online channel only. QuickSites is the fee above and nothing else. Toast is the reported online rate on
            every order plus the reported add-on, on the {dollars(p.starterMonthly * 100)} Starter plan; the guest fee
            is shown separately because the guest pays it. Each row is one average ticket size.
          </p>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-900/60 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-3 py-2 text-left">Avg ticket</th>
                  <th className="px-3 py-2 text-left">Orders / mo</th>
                  <th className="px-3 py-2 text-right text-emerald-300">QuickSites</th>
                  <th className="px-3 py-2 text-right">Toast (restaurant)</th>
                  <th className="px-3 py-2 text-right text-zinc-500">+ guest fees</th>
                </tr>
              </thead>
              <tbody>
                {TICKETS_CENTS.map((ticket) => (
                  <Fragment key={ticket}>
                    {VOLUMES.map((orders, i) => {
                      const us = quicksitesMonthlyCents({ orders, ticketCents: ticket });
                      const t = toastMonthly({ orders, ticketCents: ticket });
                      const cheaper = us < t.restaurantCents;
                      return (
                        <tr key={`${ticket}-${orders}`} className={i === 0 ? 'border-t border-zinc-800' : ''}>
                          <td className="px-3 py-2 text-zinc-400">{i === 0 ? dollars(ticket) : ''}</td>
                          <td className="px-3 py-2">{orders}</td>
                          <td className={`px-3 py-2 text-right font-medium ${cheaper ? 'text-emerald-300' : 'text-zinc-300'}`}>{dollars(us)}</td>
                          <td className={`px-3 py-2 text-right font-medium ${cheaper ? 'text-zinc-300' : 'text-emerald-300'}`}>{dollars(t.restaurantCents)}</td>
                          <td className="px-3 py-2 text-right text-zinc-500">{dollars(t.guestCents)}</td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {TICKETS_CENTS.map((ticket) => {
              const n = breakEvenOrders(ticket);
              return (
                <div key={ticket} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
                  <div className="text-xs uppercase tracking-wide text-zinc-500">{dollars(ticket)} average ticket</div>
                  <div className="mt-1 text-lg font-bold text-white">
                    {n === null ? 'QuickSites costs less at every volume' : `Even at about ${n} orders a month`}
                  </div>
                  <p className="mt-1 text-xs text-zinc-400">
                    {n === null
                      ? 'With these figures there is no volume at which Toast’s online channel costs the restaurant less.'
                      : 'Below that, QuickSites costs the restaurant less. Above it, Toast does — its per-order rate is lower once the fixed costs are covered.'}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Green marks the lower restaurant-paid cost in each row. The Point of Sale plan adds {dollars(p.posMonthly * 100)}/mo to
            Toast’s column and moves the break-even up. Hardware is not in either column.
          </p>
        </section>

        {/* Honest two-sided verdict */}
        <section className="mx-auto max-w-4xl px-6 py-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title={`What ${TOAST.name} does well`} items={strengths} tone="good" />
            <Panel title="Where QuickSites is the better fit" items={ours} tone="us" />
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Panel title={`Pick ${TOAST.name} if…`} items={pickThem} tone="good" />
            <Panel title="Pick QuickSites if…" items={pickUs} tone="us" />
          </div>
        </section>

        {/* Already on Toast but no website */}
        <section className="mx-auto max-w-4xl px-6 py-6">
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.06] p-5">
            <h2 className="text-base font-semibold text-sky-200">On Toast, but with no website of your own?</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Some restaurants have a Toast ordering page and nothing else — no site for the name, the hours, the
              story. You do not have to change how you take orders to fix that. A QuickSites site can carry your menu
              and link straight to your existing Toast ordering page. The site is free to host; the ordering stays
              where it is.
            </p>
          </div>
        </section>

        {/* CTA + sources */}
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
            <h2 className="text-xl font-semibold">See your menu as an ordering site</h2>
            <p className="mx-auto mt-1 max-w-xl text-sm text-zinc-400">
              Paste your current site or your Google listing. It builds the ordering site from your own menu; you
              confirm the prices before anything goes live. Free to host.
            </p>
            <Link href="/rebuild" className="mt-4 inline-flex rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400">
              Build it — free
            </Link>
          </div>
          <p className="mt-6 text-xs leading-relaxed text-zinc-600">
            Toast’s plan prices are from its public pricing page as read in {readOn}; its processing rates, add-on
            price and guest fee are third-party reports as of the same month, because Toast does not publish them.
            All of it changes over time — ask Toast for a quote. Sources:{' '}
            {TOAST.sources.map((s, i) => (
              <span key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-400">{s.label}</a>
                {i < TOAST.sources.length - 1 ? ', ' : '.'}
              </span>
            ))}
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
