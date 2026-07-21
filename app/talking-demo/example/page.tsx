// app/talking-demo/example/page.tsx
//
// A live "Talking Demo" example: a representative small-business site (the kind QuickSites
// auto-builds from a business's listing) with the Talking Demo bar at the top. Press ▶ and the
// site narrates itself (About That, grounded at this page). Fictional business — noindex.

import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import TalkingDemoBar from '@/components/site/talking-demo-bar';
import TalkingDemoTour from '@/components/site/talking-demo-tour';
import { EXAMPLE_TOUR } from './tour';

export const metadata = {
  title: 'Field & Oak Coffee Roasters — a Talking Demo | QuickSites',
  description:
    'A sample auto-built small-business site that narrates itself. Press play to hear the Talking Demo.',
  robots: { index: false, follow: true },
};

const BIZ = { name: 'Field & Oak Coffee Roasters' };

const OFFERINGS: Array<[string, string]> = [
  ['Small-batch roasting', 'We roast single-origin beans in 12-pound batches every Tuesday and Friday, so the bag on your shelf is never more than a week off the roaster.'],
  ['Coffee subscriptions', 'Pick a roast level and a cadence — weekly, biweekly, or monthly — and we ship (or you pick up) fresh beans on a schedule. Pause or swap anytime.'],
  ['Wholesale & cafés', 'We supply four neighborhood cafés and a handful of restaurants with house blends and training. Ask about a tasting for your team.'],
];

const HOURS: Array<[string, string]> = [
  ['Mon – Fri', '7:00 AM – 5:00 PM'],
  ['Saturday', '8:00 AM – 4:00 PM'],
  ['Sunday', 'Closed'],
];

export default function TalkingDemoExamplePage() {
  return (
    <>
      <SiteHeader sticky logoText={BIZ.name} logoHref="/talking-demo/example" />
      <main className="min-h-screen bg-gradient-to-b from-zinc-950 via-zinc-950 to-black text-zinc-100">
        {/* The Talking Demo bar — press play and the site describes itself. */}
        <div className="mx-auto max-w-4xl px-4 pt-8">
          <TalkingDemoBar subline="Press ▶ to hear this whole site in about 60 seconds — the way a customer would." />
          <p className="mt-2 text-center text-xs text-zinc-500">
            This site was auto-built as a demo. Tap play above to hear it walk through everything below.
          </p>
        </div>

        {/* The auto-generated Tier-2 reel: real narration + the site scrolling itself. Baked from a
            one-time HJ render (see ./tour.ts) — permanent URLs, so it's instant with no runtime cost. */}
        <section className="mx-auto max-w-4xl px-4 pt-10">
          <div className="rounded-2xl border border-emerald-500/30 bg-zinc-900/40 p-4 sm:p-6">
            <div className="mb-4 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-300">
                🎬 The auto-generated tour
              </div>
              <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-400">
                This ~60-second reel was generated <span className="text-zinc-200">automatically from this page</span> —
                the site narrating and scrolling through itself. Nobody wrote the script or edited the video.
              </p>
            </div>
            <TalkingDemoTour
              steps={EXAMPLE_TOUR.steps}
              mp4Url={EXAMPLE_TOUR.mp4_url}
              posterUrl={EXAMPLE_TOUR.poster_url}
              headline="Talking Demo reel"
            />
          </div>
        </section>

        {/* Hero */}
        <header className="mx-auto max-w-4xl px-4 pt-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">
            ☕ Neighborhood roaster · Est. 2019
          </div>
          <h1 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight sm:text-5xl">
            Fresh-roasted coffee from the corner of Field &amp; Oak.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-zinc-400 sm:text-base">
            A small-batch roaster in the heart of Cedar Hollow. We roast to order, sell by subscription,
            and pour a very good cortado while you wait.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="#subscribe" className="rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400">
              Start a subscription
            </a>
            <a href="#visit" className="rounded-xl border border-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-zinc-500">
              Visit the roastery
            </a>
          </div>
        </header>

        {/* What we do */}
        <section id="subscribe" className="mx-auto max-w-4xl scroll-mt-20 px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">What we do</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {OFFERINGS.map(([title, body]) => (
              <div key={title} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
                <h3 className="font-semibold text-amber-300">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Visit / hours */}
        <section id="visit" className="mx-auto max-w-4xl scroll-mt-20 px-4 pb-16">
          <div className="grid gap-8 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Visit the roastery</h2>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                Find us at 214 Oak Street, Cedar Hollow. Street parking out front, and the roaster's usually
                going in the back — follow your nose. Call ahead for wholesale pickups at (555) 018-2277.
              </p>
              <a
                href="mailto:hello@example.com?subject=Field%20%26%20Oak%20inquiry"
                className="mt-5 inline-flex rounded-xl bg-amber-500 px-6 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400"
              >
                Get in touch
              </a>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Hours</h3>
              <dl className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800 bg-zinc-900/40">
                {HOURS.map(([day, hrs]) => (
                  <div key={day} className="flex items-baseline justify-between gap-4 px-4 py-2.5">
                    <dt className="text-sm text-zinc-400">{day}</dt>
                    <dd className="text-right text-sm font-medium text-zinc-100">{hrs}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-4xl px-4 pb-16 text-center">
          <Link
            href="/talking-demo"
            className="inline-flex rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:border-emerald-400 hover:bg-emerald-500/20"
          >
            ← What is a Talking Demo?
          </Link>
          <p className="mt-6 text-xs text-zinc-600">Field &amp; Oak Coffee Roasters is a fictional business. Sample site for demonstration only.</p>
        </div>
      </main>
    </>
  );
}
