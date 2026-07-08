// app/partners/page.tsx
// Marketing landing for the white-label reseller program. Static, on-message,
// no invented pricing — partner terms are a "talk to us" conversation.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE, QS_FEE_SHARE, RESIDUAL_MONTHS } from '@/lib/commerce/partner-terms';
import { marketingOg } from '@/lib/marketingOg';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);
const qsPct = Math.round(QS_FEE_SHARE * 100);
const residualLabel = RESIDUAL_MONTHS > 0 ? `${RESIDUAL_MONTHS}-month` : 'lifetime';
// Worked example
const exOrder = 100;
const exFeePct = Math.min(8, maxFeePct);
const exFee = (exOrder * exFeePct) / 100;
const exPartner = exFee * PARTNER_FEE_SHARE;
const exQs = exFee - exPartner;
const usd = (n: number) => `$${n.toFixed(2)}`;

export const metadata = marketingOg({
  title: 'QuickSites for Partners — white-label & resell',
  description:
    'White-label the QuickSites builder + commerce to your network. Onboard merchants through whitelisted payment processors, set your platform fee, and earn on every order.',
  path: '/partners',
  ogEyebrow: 'For agencies & resellers',
  ogTitle: 'Resell websites. Earn on every sale.',
  ogSubtitle: `White-label the builder + commerce and keep ${keepPct}% of the platform fee — ${residualLabel}, on every order your merchants process.`,
});

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

const MAILTO = 'mailto:partners@quicksites.ai?subject=QuickSites%20reseller%20partnership';

export default function PartnersPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          <span className="rounded-full border border-sky-500/40 bg-sky-500/10 px-3 py-1 text-xs font-medium text-sky-300">
            Reseller / white-label program
          </span>
          <h1 className="mt-6 text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-sky-200">
            Resell QuickSites. Earn the slice.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            Bring a powerful site builder with e-commerce built in to your network — under your own
            brand. Hosting is free. Set your merchants' order fee up to {maxFeePct}%, keep{' '}
            <span className="font-semibold text-zinc-200">{keepPct}%</span> of every fee as a{' '}
            {residualLabel} residual, and onboard through your whitelisted payment processor.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/partners/dashboard" className="rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
              Get your partner link
            </Link>
            <a href={MAILTO} className="rounded-lg border border-sky-500 px-6 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200">
              Talk to us
            </a>
          </div>
          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-center text-sm">
            <Link href="/partners/calculator" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
              Estimate your earnings vs. a flat-markup builder →
            </Link>
            <Link href="/compare" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
              How we compare vs Duda &amp; GoHighLevel →
            </Link>
          </p>
        </section>

        {/* The model */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">How partners earn</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Free hosting brings merchants in. The order economics on top are yours.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title={`Set the fee — up to ${maxFeePct}%`}>
                You set each merchant's per-order platform fee (anything up to {maxFeePct}%). It's
                collected automatically via Stripe Connect, and refunds reverse it cleanly.
              </Card>
              <Card title={`Keep ${keepPct}% of every fee`}>
                On every order, you keep {keepPct}% of the fee and QuickSites keeps {qsPct}% — tracked
                in a commission ledger with payout runs. No per-site charge; hosting is free.
              </Card>
              <Card title={`${residualLabel.replace(/^./, (c) => c.toUpperCase())} residual`}>
                {RESIDUAL_MONTHS > 0
                  ? `Earn for ${RESIDUAL_MONTHS} months on every merchant you bring on.`
                  : 'Earn on every order your merchants process, ongoing — for the life of the relationship.'}
              </Card>
            </div>

            {/* Worked example */}
            <div className="mt-8 max-w-xl rounded-xl border border-sky-500/30 bg-sky-500/5 p-5">
              <div className="text-sm font-semibold text-zinc-200">The math, on a {usd(exOrder)} order</div>
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between"><dt className="text-zinc-400">Your fee ({exFeePct}%)</dt><dd>{usd(exFee)}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-400">You keep ({keepPct}%)</dt><dd className="font-semibold text-sky-300">{usd(exPartner)}</dd></div>
                <div className="flex justify-between"><dt className="text-zinc-400">QuickSites ({qsPct}%)</dt><dd>{usd(exQs)}</dd></div>
              </dl>
              <p className="mt-3 text-xs text-zinc-500">…on every order, {residualLabel}. The merchant keeps the rest of the sale.</p>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">What you get</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <Card title="Your brand">White-label theming per partner — your logo, domain, and customers throughout.</Card>
              <Card title="Whitelisted processors">Onboard merchants through approved payment processors via Stripe Connect.</Card>
              <Card title="The full builder">Drag-and-drop sites with e-commerce, custom domains, AI assist, and SEO.</Card>
              <Card title="Customer CRM + campaigns">Every merchant gets a CRM that fills itself from orders, plus consent-gated email campaigns with revenue attribution.</Card>
              <Card title="Partner dashboard">Track GMV, fees collected, commissions owed, and payouts in one place.</Card>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold">How it works</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                ['1', 'Apply', 'Tell us about your network and payment processor. We whitelist and set you up.'],
                ['2', 'White-label & onboard', 'Brand it as yours; onboard merchants and set your platform fee.'],
                ['3', 'Earn', 'Collect your take-rate on every order, plus residual commissions — reconciled for you.'],
              ].map(([n, title, body]) => (
                <div key={n}>
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 font-bold text-zinc-950">{n}</div>
                  <h4 className="mt-3 font-semibold">{title}</h4>
                  <p className="mt-1 text-sm text-zinc-400">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Link href="/partners/dashboard" className="rounded-lg bg-sky-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
                Become a partner
              </Link>
            </div>
          </div>
        </section>

        <footer className="border-t border-zinc-800/70 py-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} QuickSites.ai —{' '}
          <Link href="/" className="underline hover:text-zinc-300">Home</Link>
          <span className="mx-1">•</span>
          <Link href="/pricing" className="underline hover:text-zinc-300">Pricing</Link>
          <span className="mx-1">•</span>
          <Link href="/features" className="underline hover:text-zinc-300">Features</Link>
          <span className="mx-1">•</span>
          <Link href="/compare" className="underline hover:text-zinc-300">Compare</Link>
        </footer>
      </div>
    </>
  );
}
