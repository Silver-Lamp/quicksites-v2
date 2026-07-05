// app/partners/resellers/page.tsx
// Targeted landing for resellers already reselling web software (Duda / GoHighLevel /
// Vendasta / cPanel resellers). The wedge: they earn a FLAT markup today; here they
// earn a share of every sale (GMV residual). Speaks their language, points at the
// rebuild tool (migration objection) + the calculator (the money). No invented terms.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE, RESIDUAL_MONTHS } from '@/lib/commerce/partner-terms';
import { marketingOg } from '@/lib/marketingOg';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);
const residualLabel = RESIDUAL_MONTHS > 0 ? `${RESIDUAL_MONTHS}-month` : 'lifetime';

export const metadata = marketingOg({
  title: 'Already reselling web software? Add GMV upside — QuickSites',
  description:
    'Duda and GoHighLevel pay you a flat markup no matter how well your clients do. QuickSites pays you a share of every sale your clients make. Same book of business, uncapped upside.',
  path: '/partners/resellers',
  ogEyebrow: 'For Duda / GoHighLevel resellers',
  ogTitle: 'Stop earning a flat markup.',
  ogSubtitle: `Keep ${keepPct}% of the fee on every order your clients process — ${residualLabel}. The upside your current stack can't pay.`,
});

const MAILTO = 'mailto:partners@quicksites.ai?subject=Switching%20from%20Duda%2FGoHighLevel';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-center">
      <div className="text-3xl font-bold text-sky-300">{value}</div>
      <div className="mt-1 text-sm text-zinc-400">{label}</div>
    </div>
  );
}

export default function ResellersPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
            Already reselling Duda, GoHighLevel, or hosting?
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            You resell the software.
            <span className="block bg-gradient-to-r from-sky-400 to-sky-200 bg-clip-text text-transparent">
              Why cap your upside at a flat markup?
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            Duda and GoHighLevel pay you the same whether your client does $0 or $1M in sales — you
            mark up a flat seat. QuickSites pays you <span className="font-semibold text-zinc-200">{keepPct}% of
            the fee on every order</span> your clients process, {residualLabel}. Same clients, same effort,
            uncapped upside.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/partners/calculator" className="rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
              Estimate your earnings →
            </Link>
            <Link href="/rebuild" className="rounded-lg border border-sky-500 px-6 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200">
              Rebuild a client's site free
            </Link>
          </div>
        </section>

        {/* The switch cost objection */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-5xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">"But moving my clients is a nightmare."</h2>
            <p className="mt-3 max-w-2xl text-zinc-400">
              It isn't. You don't migrate a portfolio of legacy sites — you don't even rebuild them by hand.
              Two paths, both fast:
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <div className="text-sm font-semibold uppercase tracking-wide text-sky-400">New clients</div>
                <h3 className="mt-2 text-lg font-semibold">Start net-new, instantly</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Every new client starts on QuickSites. Pick an industry and the AI seeds a working,
                  on-brand site in seconds — no blank canvas, no theme wrangling.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <div className="text-sm font-semibold uppercase tracking-wide text-sky-400">Existing clients</div>
                <h3 className="mt-2 text-lg font-semibold">Rebuild from their live URL</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Paste a client's current site and our AI regenerates it as an editable QuickSites draft.
                  It's a migration and a sales demo in one.{' '}
                  <Link href="/rebuild" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">Try it →</Link>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Why us over them */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">Why switch (or add) QuickSites</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Stat value={`${keepPct}%`} label={`of every order's fee — yours, ${residualLabel}`} />
              <Stat value="$0" label="hosting cost — no monthly seat to cover first" />
              <Stat value={`${maxFeePct}%`} label="max fee you set per merchant" />
              <Stat value="0%" label="what Duda takes on your clients' sales" />
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3">
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h3 className="font-semibold text-white">A model they can't copy</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Duda takes 0% on store sales; GoHighLevel has essentially no ecommerce. Both monetize
                  flat seats by design. A take-rate + residual is the revenue model they've chosen not to build.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h3 className="font-semibold text-white">Your brand, front and center</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  White-label the builder, client login, admin, and transactional emails. Your clients see
                  you — not us.
                </p>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
                <h3 className="font-semibold text-white">Verticals they can't serve</h3>
                <p className="mt-2 text-sm text-zinc-400">
                  Real product commerce, plus print-on-demand author/apparel stores (Lulu + Gelato) — a
                  category neither Duda nor GoHighLevel answers.
                </p>
              </div>
            </div>
            <p className="mt-6 text-sm text-zinc-500">
              Want the honest, sourced side-by-side (including where they beat us)?{' '}
              <Link href="/compare" className="text-sky-400 underline underline-offset-2 hover:text-sky-300">See the comparison →</Link>
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">Bring your book of business — keep the upside</h2>
            <p className="mx-auto mt-3 max-w-xl text-zinc-400">
              Get your partner link in a click, or talk to us about moving a client base over.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/partners/dashboard" className="rounded-lg bg-sky-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
                Get your partner link
              </Link>
              <a href={MAILTO} className="rounded-lg border border-sky-500 px-7 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200">
                Talk to us about switching
              </a>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/partners" className="underline hover:text-zinc-300">Partners</Link>
          <span className="mx-1">•</span>
          <Link href="/partners/calculator" className="underline hover:text-zinc-300">Calculator</Link>
          <span className="mx-1">•</span>
          <Link href="/compare" className="underline hover:text-zinc-300">Compare</Link>
          <span className="mx-1">•</span>
          <Link href="/rebuild" className="underline hover:text-zinc-300">Rebuild tool</Link>
        </footer>
      </div>
    </>
  );
}
