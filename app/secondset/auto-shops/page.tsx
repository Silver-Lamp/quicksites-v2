// app/secondset/auto-shops/page.tsx
// The apex-directory concept behind SecondSet: <city>-auto-repair.com — a driver-facing
// directory of shops that "show you the work". Honest framing: this is the growth idea that
// carries the pilot, not a live marketplace yet. No invented traffic numbers.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'SecondSet · trusted-auto-shop directories',
  description:
    'The idea behind SecondSet’s growth: a driver-facing directory at <city>-auto-repair.com featuring local shops that show customers the work. One shop per city leads; the rest of the cohort is listed.',
  path: '/secondset/auto-shops',
  ogEyebrow: 'SecondSet · directory concept',
  ogTitle: 'The most transparent shop in town gets the front page.',
  ogSubtitle: 'A driver-facing <city>-auto-repair.com directory — shops that show you the work.',
});

const MAILTO =
  'mailto:hello@quicksites.ai?subject=SecondSet%20auto-shop%20directory%20%E2%80%94%20interested';

export default function AutoShopsDirectoryConceptPage() {
  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <section className="mx-auto max-w-3xl px-6 pt-20 pb-12 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400">
            SecondSet · directory concept
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">
            <span className="text-emerald-400">Trusted auto shops</span>, one city at a time.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            SecondSet gives a shop the transparency tool. The directory gives it a front door: a clean,
            driver-facing page at <span className="font-mono text-zinc-200">yourcity-auto-repair.com</span>{' '}
            that lists local shops which show customers the work — the most transparent one featured
            first.
          </p>
        </section>

        <section className="mx-auto max-w-4xl px-6 pb-14">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
              <div className="text-2xl">🔧</div>
              <h4 className="mt-2 font-semibold text-white">A page that ranks</h4>
              <p className="mt-2 text-sm text-zinc-400">
                An exact-match local domain drivers actually search — pointed at the shops earning trust
                the honest way.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
              <div className="text-2xl">★</div>
              <h4 className="mt-2 font-semibold text-white">Lead by showing the work</h4>
              <p className="mt-2 text-sm text-zinc-400">
                The featured slot goes to the shop putting transparency first — not the biggest ad
                budget. The rest of the cohort is listed alongside.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
              <div className="text-2xl">🚗</div>
              <h4 className="mt-2 font-semibold text-white">Driver-first, no jargon</h4>
              <p className="mt-2 text-sm text-zinc-400">
                No “competition” framing shown to drivers — just trusted shops nearby and what makes them
                worth the drive.
              </p>
            </div>
          </div>

          <div className="mt-12 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-8 text-center">
            <h2 className="text-xl font-bold">Want your city’s page?</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-zinc-400">
              We’re standing these up one market at a time, alongside the SecondSet pilot. If you run a
              shop that already does right by customers, tell us your city.
            </p>
            <div className="mt-6">
              <a
                href={MAILTO}
                className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                Claim your city
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/secondset" className="underline hover:text-zinc-300">
            SecondSet
          </Link>
          <span className="mx-1">•</span>
          <Link href="/features" className="underline hover:text-zinc-300">
            Features
          </Link>
        </footer>
      </div>
    </>
  );
}
