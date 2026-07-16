// app/local-services/page.tsx
// Public local-services / trades landing (owner-facing). The generic version of the
// per-business claim page for the geo-campaign verticals (towing, HVAC, plumbing,
// electrical, roofing, contractors…). Services are LEAD-GEN, not commerce: the offer is
// an exact-match geo domain that ranks for "<trade> in <city>" and sends calls, on a
// flat monthly rent with a founder rate until it hits page 1 (see
// docs/GEO_DOMAIN_MONETIZATION.md). Emerald identity to distinguish this vertical from
// the amber restaurant page and the sky-accented partner/compare pages.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { marketingOg } from '@/lib/marketingOg';

export const metadata = marketingOg({
  title: 'Get found for “your trade in your city” — a website that brings the calls | QuickSites',
  description:
    'We build your service business a mobile website from your Google listing, on an exact-match local domain that ranks for what people search — so the calls come to you. You pay a low founder rate until it’s on page 1.',
  path: '/local-services',
  ogEyebrow: 'For local service businesses',
  ogTitle: 'Own “your city + your trade” online.',
  ogSubtitle:
    'A ranking local domain that brings you the calls. You don’t pay full until it’s on page 1.',
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

export default function LocalServicesPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="relative mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          {/* Emerald glow — the local-services vertical keeps a "get found / grow" identity. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            For local service businesses
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            The calls should come
            <span className="block bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
              to you.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            We build your towing, HVAC, plumbing, electrical, roofing or contracting business a
            mobile website — on a local domain that ranks for what people actually search, like{' '}
            <span className="font-semibold text-zinc-200">“towing in your city.”</span> When they
            find it, they tap to call <span className="font-semibold text-zinc-200">you</span>. You
            pay a low founder rate until it’s on page&nbsp;1 of Google.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/rebuild"
              className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
            >
              See your site — free
            </Link>
            <a
              href="#how"
              className="rounded-lg border border-emerald-500 px-6 py-3 text-base font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              How it works
            </a>
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            Takes about a minute. No credit card. Nothing to install.
          </p>
        </section>

        {/* Built from your listing */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">
              No website? We build one from your listing.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              You don’t start from a blank page. Point us at your business and our AI reads your
              Google listing — your services, service area, hours and phone — and assembles a real,
              working site.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="Your services & service area">
                What you do and where you do it, laid out the way a customer in a hurry needs it —
                so the person with a burst pipe or a dead battery calls you first.
              </Card>
              <Card title="Tap-to-call & quote requests">
                A phone in an emergency doesn’t want a form maze. One tap to call, or a quick
                “request a quote” that lands in your inbox. Every visit is a chance at a job.
              </Card>
              <Card title="Yours in one tap">
                Like what you see? Claim it — it becomes your account, and you can edit and publish
                it. If not, no cost, no follow-up.
              </Card>
            </div>
          </div>
        </section>

        {/* Get found */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">
              Rank for what your customers search.
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              People don’t search your business name — they search “
              <span className="text-zinc-200">plumber near me</span>” or “
              <span className="text-zinc-200">towing in Renton</span>.” Your site lives on a domain
              that matches those words exactly, so Google has an easy reason to show it.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Card title="Exact-match local domain">
                A name like your-city-plumbing.com — the search term, on the door.
              </Card>
              <Card title="Built to be found">
                Fast, mobile-first, and structured the way Google reads a local business.
              </Card>
              <Card title="The call comes to you">
                No lead marketplace splitting you across five competitors — it’s your domain, your
                phone.
              </Card>
              <Card title="Keep the lead apps if you want">
                Angi, Thumbtack, wherever — this is your own front door, working alongside them.
              </Card>
            </div>
          </div>
        </section>

        {/* The model */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
              The honest part
            </span>
            <h2 className="mt-5 text-3xl font-bold md:text-4xl">
              You don’t pay full until it ranks.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-lg text-zinc-400">
              Getting to page&nbsp;1 takes time, so you shouldn’t pay like you’re already there.
              Lock in a low founder rate now — it stays low until the site actually reaches
              page&nbsp;1 of Google for your trade and city. No long contract, no per-lead metering,
              no setup cost. If it’s not bringing you calls, you walk.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-24 border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">How it works</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                [
                  '1',
                  'We build it',
                  'From your Google listing — your services, service area, hours and phone. Ready in about a minute.',
                ],
                [
                  '2',
                  'You claim it',
                  'Preview it, and if you like it, claim it in one tap. It becomes yours to edit and publish.',
                ],
                [
                  '3',
                  'You get the calls',
                  'It goes live on a ranking local domain. Founder rate until it hits page 1 — then, and only then, the full rate.',
                ],
              ].map(([n, title, body]) => (
                <div key={n}>
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-zinc-950">
                    {n}
                  </div>
                  <h4 className="mt-3 font-semibold">{title}</h4>
                  <p className="mt-1 text-sm text-zinc-400">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link
                href="/rebuild"
                className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                See your site — free
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-3xl px-6 py-14">
            <h2 className="text-center text-2xl font-semibold md:text-3xl">Straight answers</h2>
            <div className="mt-8 space-y-4">
              {[
                [
                  'What does it cost?',
                  'You lock in a low founder rate now, and it stays there until the site reaches page 1 of Google for your trade and city. Only then does it step up to the full monthly rate. No setup fee, no long contract.',
                ],
                [
                  'I already have a website.',
                  'Take a look and compare, no pressure. Most owners find their old site never shows up when someone searches their trade nearby — that’s the whole game, and it’s where the calls are.',
                ],
                [
                  'How do I actually get leads?',
                  'The site lives on a domain that matches what people search (“your-city + your-trade”), built to rank locally. When it shows up, they tap to call you or request a quote — it comes straight to you, not a lead marketplace.',
                ],
                [
                  'Is it really going to rank?',
                  'No one can promise page 1 on day one — which is exactly why you pay the low founder rate until it gets there. You’re not paying full price for a promise; you’re paying it for a result.',
                ],
                [
                  'Who are you?',
                  'We build and host websites for local service businesses and put them on ranking local domains. We keep the rate low until it’s working, because we only win when you’re getting calls.',
                ],
              ].map(([q, a]) => (
                <div key={q} className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
                  <h4 className="font-semibold text-white">{q}</h4>
                  <p className="mt-2 text-sm text-zinc-400">{a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">
              See what we built for your business.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              Free to look. Yours in one tap if you like it.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/rebuild"
                className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                See your site — free
              </Link>
              <Link
                href="/contact"
                className="rounded-lg border border-emerald-500 px-7 py-3 text-base font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
              >
                Talk to us
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/" className="underline hover:text-zinc-300">
            Home
          </Link>
          <span className="mx-1">•</span>
          <Link href="/rebuild" className="underline hover:text-zinc-300">
            Build your site
          </Link>
          <span className="mx-1">•</span>
          <Link href="/partners" className="underline hover:text-zinc-300">
            Partners
          </Link>
        </footer>
      </div>
    </>
  );
}
