// app/partners/page.tsx
// Marketing landing for the white-label reseller program. Static, on-message,
// no invented pricing — partner terms are a "talk to us" conversation.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';

export const metadata = {
  title: 'QuickSites for Partners — white-label & resell',
  description:
    'White-label the QuickSites builder + commerce to your network. Onboard merchants through whitelisted payment processors, set your platform fee, and earn on every order.',
};

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
            brand. Onboard merchants through your whitelisted payment processor, set your platform
            fee, and earn on every order they process.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href={MAILTO} className="rounded-lg bg-sky-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
              Talk to us
            </a>
            <Link href="/features" className="rounded-lg border border-sky-500 px-6 py-3 text-base font-medium text-sky-300 transition hover:bg-sky-500/10 hover:text-sky-200">
              See features
            </Link>
          </div>
        </section>

        {/* The model */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">How partners earn</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Near-free hosting brings merchants in. The economics on top are yours.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="Your take-rate, per order">
                Collect a percentage of every order your merchants process via Stripe Connect — you
                set the fee, it’s applied automatically, and refunds reverse it cleanly.
              </Card>
              <Card title="Residual commissions">
                Earn recurring on the merchants you bring on, tracked in a commission ledger with
                payout runs — built for ongoing partner revenue, not one-off referrals.
              </Card>
              <Card title="Hosting upsell">
                Offer free or near-free hosting to win merchants, then upsell plans — the platform
                handles billing and plan limits.
              </Card>
            </div>
          </div>
        </section>

        {/* What you get */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl md:text-3xl font-semibold">What you get</h2>
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <Card title="Your brand">White-label theming per partner — your logo, domain, and customers throughout.</Card>
              <Card title="Whitelisted processors">Onboard merchants through approved payment processors via Stripe Connect.</Card>
              <Card title="The full builder">Drag-and-drop sites with e-commerce, custom domains, AI assist, and SEO.</Card>
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
              <a href={MAILTO} className="rounded-lg bg-sky-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-sky-400">
                Become a partner
              </a>
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
        </footer>
      </div>
    </>
  );
}
