// app/supplements/page.tsx
//
// Supplement / wellness brand vertical landing — MERCHANT-FACING ONLY.
//
// ⚠️ Written as the first deliverable of docs/AUDIENCE_SPLIT_PLAN.md, for a rep to send a prospect.
// There is nothing here about reselling, partner margin, overrides or commissions, and nothing
// should be added: the whole point of the page is that a business owner reads one offer.
//
// ⚠️ TWO PRODUCT LIMITS ARE LOAD-BEARING IN THIS COPY, AND BOTH WERE CHECKED IN THE SOURCE RATHER
// THAN ASSUMED (2026-09-25):
//
//   1. NO SUBSCRIPTIONS. `lib/commerce/adapters/stripeAdapter.ts` opens Checkout with
//      `mode: 'payment'`. Subscribe-and-save is close to table stakes in this category, so the
//      temptation to imply it is real — the page says plainly that we do not have it, and offers
//      the thing we DO have (segment your repeat buyers and email them) without dressing it up as
//      the same feature.
//   2. NO CARRIER-CALCULATED SHIPPING. `computePhysicalShippingCents` is flat/per-item and
//      env-gated, 0 by default. "Real-time USPS rates" would be a lie a merchant discovers on
//      their first order.
//
// ⚠️ AND ONE HONESTY LINE THAT IS NOT MARKETING: we do not write health claims. Our AI drafts page
// copy, and a model that cheerfully writes "supports immune health" under a real brand's name is
// the invented-menu / "licensed & insured" failure with the FTC attached. Saying so is both the
// true thing and the thing a careful founder in this category wants to hear.
import Link from 'next/link';
import SiteHeader from '@/components/site/site-header';
import PageBackdrop from '@/components/site/page-backdrop';
import { marketingOg } from '@/lib/marketingOg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const metadata = marketingOg({
  title: 'Supplement & wellness storefronts — built in a day | QuickSites',
  description:
    'A storefront for your supplement brand: product catalog with sizes and counts, Stripe checkout, stock tracking, and a customer list that builds itself from orders. Free hosting; a small fee per order.',
  path: '/supplements',
  ogEyebrow: 'For supplement & wellness brands',
  ogTitle: 'Your supplement brand, selling online.',
  ogSubtitle: 'Catalog, checkout and a customer list that builds itself. Free to host.',
});

const MAILTO = 'mailto:hello@quicksites.ai?subject=Supplement%20brand%20storefront';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-left">
      <h4 className="text-base font-semibold text-white">{title}</h4>
      <p className="mt-2 text-sm text-zinc-400">{children}</p>
    </div>
  );
}

export default function SupplementsPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <PageBackdrop style="mesh" />

        {/* Hero */}
        <section className="relative mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl" />
          </div>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
            For supplement &amp; wellness brands
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-6xl">
            Your brand, with a
            <span className="block bg-gradient-to-r from-emerald-400 to-emerald-200 bg-clip-text text-transparent">
              real storefront behind it.
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
            A product page per SKU, sizes and counts as variants, a cart, and card payments that land
            in your own Stripe account. Hosting is free — you pay a small fee only when you sell
            something.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/build"
              className="rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
            >
              Start building — free
            </Link>
            <Link
              href="/book"
              className="rounded-lg border border-emerald-500 px-6 py-3 text-base font-medium text-emerald-300 transition hover:bg-emerald-500/10 hover:text-emerald-200"
            >
              Book a walkthrough
            </Link>
          </div>
          <p className="mt-4 text-sm">
            <Link href="/pricing" className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
              See what it costs →
            </Link>
          </p>
        </section>

        {/* What you get */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">What you get</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              The whole thing — site, store and customer list — not a storefront bolted onto a
              template.
            </p>
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              <Card title="A catalog with variants">
                One product, many SKUs — 30ct and 90ct, single tub and three-pack, flavours. Each
                variant carries its own price, and the price a customer pays is always the one on the
                server, never the one their browser sent.
              </Card>
              <Card title="Stock, if you want it">
                Track units per product or per variant and a sold-out SKU stops selling instead of
                overselling. Leave it untracked and it is unlimited — most brands start there.
              </Card>
              <Card title="Card payments, straight to you">
                Stripe Checkout with the shipping address and phone collected. Money lands in your own
                Stripe account; we are never in the middle of it.
              </Card>
              <Card title="Sales tax handled">
                Turn on automatic tax and Stripe computes it at checkout, records it on the order, and
                keeps it out of the fee we take.
              </Card>
              <Card title="A customer list that builds itself">
                Every paid order becomes a customer record — lifetime value, order history, a full
                timeline — with no data entry. Filter to repeat buyers, lapsed buyers or the ones who
                opted in.
              </Card>
              <Card title="Email that reports back">
                Send a consent-gated campaign to a segment and see the orders and revenue it drove.
                One-click unsubscribe is built in, because a supplement list gets complained about
                fast if it is not.
              </Card>
            </div>
          </div>
        </section>

        {/* ⚠️ The honest section. Do not soften it and do not move it below the fold of the page's
            second half — a limit a merchant finds on their first order costs far more than a limit
            they read here. */}
        <section className="border-t border-zinc-800/70">
          <div className="mx-auto max-w-4xl px-6 py-14">
            <h2 className="text-2xl font-semibold md:text-3xl">What we don&apos;t do (yet)</h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Two of these matter specifically in this category, so they are here rather than in a
              footnote you find after launch.
            </p>
            <div className="mt-8 space-y-4">
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <h4 className="text-base font-semibold text-amber-200">No subscriptions yet</h4>
                <p className="mt-2 text-sm text-zinc-300">
                  Checkout takes one-time payments. There is no subscribe-and-save, and we are not
                  going to pretend the alternative is the same thing — but the alternative is real:
                  your repeat buyers are already segmented, so you can email a reorder offer to
                  exactly the people who are due and see what it made. If recurring billing is the
                  deciding feature for you, say so and we will tell you honestly where it sits.
                </p>
              </div>
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                <h4 className="text-base font-semibold text-amber-200">Flat shipping, not carrier rates</h4>
                <p className="mt-2 text-sm text-zinc-300">
                  You set a shipping amount; we do not quote live USPS or UPS rates at checkout. For a
                  brand shipping a few standard package sizes that is usually fine, and for one
                  shipping cases it is usually not.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                <h4 className="text-base font-semibold text-emerald-200">
                  And one we do on purpose: we don&apos;t write health claims
                </h4>
                <p className="mt-2 text-sm text-zinc-300">
                  Our AI will draft your page copy in seconds. It will not write what your product
                  does for someone&apos;s body — no &ldquo;supports immune health&rdquo;, no
                  &ldquo;clinically proven&rdquo;, nothing that reads as a structure&#47;function
                  claim. Those are yours to write and yours to stand behind, because they are claims
                  about your product that only you can make. A tool that invents them for you is a
                  liability wearing a time-saver&apos;s coat.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-zinc-800/70 bg-zinc-950/60">
          <div className="mx-auto max-w-6xl px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold md:text-3xl">How it goes</h2>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
              {[
                ['1', 'Describe the brand', 'Tell us what you sell. A real site appears — pages, sections and images — and you edit it live.'],
                ['2', 'Add the products', 'One entry per product, variants for sizes and counts, photos and prices. Connect Stripe.'],
                ['3', 'Publish and sell', 'Go live on your own domain. Orders, customers and revenue are all in one dashboard.'],
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
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/build"
                className="rounded-lg bg-emerald-500 px-7 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                Start building — free
              </Link>
              <a
                href={MAILTO}
                className="rounded-lg border border-zinc-700 px-7 py-3 text-base font-medium text-zinc-300 transition hover:bg-zinc-800"
              >
                Ask us something first
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
          <span className="mx-1">•</span>
          <Link href="/contact" className="underline hover:text-zinc-300">Contact</Link>
        </footer>
      </div>
    </>
  );
}
