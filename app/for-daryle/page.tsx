// app/for-daryle/page.tsx
// Personal, UNLISTED orientation page for Daryle — his network is payment
// processing companies (ISOs / merchant-services providers) who could white-label
// QuickSites to the small businesses they already serve, with transactions running
// on THEIR rails instead of Stripe. Public URL, noindex, linked from nowhere.
// The Stripe-swap story is kept architecturally honest: the money path is a
// provider-agnostic adapter seam (lib/commerce/paymentAdapter.ts); Stripe is the
// reference implementation, not a hard dependency.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT, PARTNER_FEE_SHARE, QS_FEE_SHARE, RESIDUAL_MONTHS } from '@/lib/commerce/partner-terms';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const keepPct = Math.round(PARTNER_FEE_SHARE * 100);
const qsPct = Math.round(QS_FEE_SHARE * 100);
const residualLabel = RESIDUAL_MONTHS > 0 ? `for ${RESIDUAL_MONTHS} months` : 'for life';

export const metadata: Metadata = {
  title: 'QuickSites — for Daryle',
  description: 'White-labeling QuickSites for payment processors.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

/** Native-details expander — server-rendered, zero JS. */
function More({ label = 'More detail', children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">›</span>
        {label}
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-400">{children}</div>
    </details>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-sm leading-relaxed text-zinc-400">
      <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">Example</span>
      {children}
    </div>
  );
}

function Card({
  title,
  tag,
  children,
  more,
  moreLabel,
}: {
  title: string;
  tag?: string;
  children: React.ReactNode;
  more?: React.ReactNode;
  moreLabel?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && (
          <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
            {tag}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      {more && <More label={moreLabel}>{more}</More>}
    </div>
  );
}

export default function ForDarylePage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pt-16 pb-10">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
            Unlisted — just for you
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Daryle 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            You know payment processing companies. I built a platform they might want to hand their
            small-business merchants — under their own brand, with transactions on <em>their</em>{' '}
            rails. This page is the whole picture, cards expand if you want the gears.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            The one-liner: <span className="text-zinc-300">QuickSites gives small businesses a free
            website with online ordering built in, and takes a small fee per order.</span> For a
            processor, that means new online volume from merchants they already have — and a
            stickier merchant relationship.
          </p>
        </section>

        {/* Why a processor cares */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Why a payment company would want this
          </h2>
          <div className="mt-4 space-y-4">
            <Card
              title="New processing volume from merchants they already have"
              tag="volume"
              more={
                <>
                  <p>
                    A huge share of small merchants — restaurants especially — have no website and
                    take zero online orders. Every one of those a processor activates with a
                    QuickSites storefront starts pushing card-not-present volume through the
                    processor&apos;s existing merchant account. It&apos;s incremental volume with no
                    new merchant acquisition cost.
                  </p>
                  <Example>
                    A processor&apos;s book has 500 SMB merchants; say 50 adopt the free site + online
                    ordering and average $3,000/mo in new online orders. That&apos;s $150k/mo of fresh
                    volume on rails the processor already owns.
                  </Example>
                </>
              }
            >
              Merchants with no online presence process nothing online. Give them a free site with
              ordering built in, and that volume appears — on the processor&apos;s rails, from
              merchants already on their book.
            </Card>

            <Card
              title="Stickiness — the site lives with the processor"
              tag="churn ↓"
              more={
                <>
                  <p>
                    Merchant services is a churn business — merchants rate-shop and switch. When the
                    merchant&apos;s website, online menu, and order flow are part of the
                    processor&apos;s bundle (under the processor&apos;s brand), switching processors
                    means disrupting the storefront their customers use. That&apos;s a much harder
                    conversation than moving a terminal.
                  </p>
                </>
              }
            >
              A merchant whose website and ordering flow come bundled with their processor doesn&apos;t
              rate-shop the same way. The storefront becomes the moat around the processing
              relationship.
            </Card>

            <Card
              title="A branded product, not a referral"
              tag="white-label"
              more={
                <>
                  <p>
                    The whole client-facing surface rebrands: the processor&apos;s logo and name on the
                    builder, login pages, and transactional emails; their domain; their accent
                    colors. Their merchants sign up under the processor&apos;s brand and never see
                    QuickSites anywhere. This is live today — it&apos;s the same white-label program
                    our agency resellers use.
                  </p>
                  <p>
                    Economics on the software side: the partner sets the per-order platform fee for
                    their merchants (up to {maxFeePct}%), keeps {keepPct}% of it {residualLabel};
                    QuickSites keeps {qsPct}% for running the rails. That&apos;s <em>on top of</em>{' '}
                    whatever they earn on processing — two revenue lines from the same merchant.
                  </p>
                  <Example>
                    Those 50 activated merchants at $150k/mo combined, with the processor setting a
                    5% platform fee: $7,500/mo in fees, ${(7500 * PARTNER_FEE_SHARE).toLocaleString()}
                    /mo to the processor — stacked on their processing margin from the same new
                    volume.
                  </Example>
                </>
              }
            >
              &ldquo;Free website + online ordering&rdquo; becomes a line item in the processor&apos;s
              merchant-services bundle, under their own brand — a differentiator their competitors
              can&apos;t match with a rate sheet.
            </Card>

            <Card
              title="We can even feed their sales pipeline"
              tag="lead gen"
              more={
                <>
                  <p>
                    Our growth engine sweeps a city and finds every business with no website, then
                    pre-builds working sites for them (for restaurants, the menu is read off their
                    public listing photos by AI). Today we use that to acquire merchants for
                    ourselves. A processor partner could point the same machine at their territory:
                    pre-built sites as the door-opener for <em>their</em> reps, converting
                    no-website businesses into processing accounts.
                  </p>
                </>
              }
            >
              We already operate a discovery engine that finds no-website businesses and pre-builds
              their sites before first contact. Pointed at a processor&apos;s territory, that&apos;s a
              door-opener for their sales team.
            </Card>
          </div>
        </section>

        {/* The Stripe question */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            &ldquo;But we&apos;re not going to run it on Stripe&rdquo; — correct
          </h2>
          <div className="mt-4">
            <Card
              title="Their rails, not ours"
              tag="processor-agnostic by design"
              moreLabel="The honest engineering story"
              more={
                <>
                  <p>
                    The money path was built behind a provider adapter from day one: every merchant
                    account carries a <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">provider</code>{' '}
                    field (stripe / paypal / square / authorize_net / custom), and checkout routes
                    through an adapter interface — create the checkout, parse the payment webhooks.
                    Stripe is the reference implementation because that&apos;s where our own volume
                    runs, not because anything depends on it.
                  </p>
                  <p>
                    Bringing a processor&apos;s gateway means implementing one adapter against their
                    APIs — hosted checkout or tokenized payment page, plus their webhook/settlement
                    events — and deciding together how the per-order platform fee is collected on
                    their rails (Stripe does it natively in the transaction; other rails may prefer
                    ledger-and-invoice). It&apos;s a scoped integration project per processor, not a
                    re-architecture — and we&apos;d build it <em>with</em> their integration team,
                    who know their own APIs best.
                  </p>
                  <p>
                    Everything above the payment seam — builder, ordering, menus, receipts, the
                    merchant dashboard, the white-label branding — is identical regardless of whose
                    rails settle the money.
                  </p>
                </>
              }
            >
              For a processor partner, we swap the payment layer for theirs: their gateway runs the
              transactions, their merchant accounts settle the money. The platform was architected
              for exactly this — payments sit behind a per-merchant provider adapter, and Stripe is
              just the first adapter, not a dependency.
            </Card>
          </div>
        </section>

        {/* Where Daryle fits */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Where you come in
          </h2>
          <div className="mt-4">
            <Card
              title="You make the introductions"
              tag="override on every partner you bring"
              moreLabel="How your cut works"
              more={
                <>
                  <p>
                    The platform has a built-in two-tier arrangement for exactly this: the person who
                    recruits a partner (&ldquo;hub&rdquo;) earns a lifetime override on every order
                    that partner&apos;s whole merchant book processes. Your slice is carved out of{' '}
                    <em>QuickSites&apos; {qsPct}% share</em> — never out of what the processor earns —
                    so it costs your contacts nothing to have you in the deal.
                  </p>
                  <p>
                    It&apos;s tracked automatically in a commission ledger from the moment an order
                    settles, and pays out on real payout runs. For processor-scale deals we&apos;d
                    also talk specifics person-to-person — the mechanics exist, the terms are a
                    conversation.
                  </p>
                  <Example>
                    One mid-size processor you introduce activates merchants doing $500k/mo in new
                    online volume at a 5% platform fee = $25k/mo in fees. Your override at, say,
                    half of QuickSites&apos; share would be $2,500/mo — recurring, from one
                    introduction, while the processor does the selling.
                  </Example>
                </>
              }
            >
              You know the people who own these merchant relationships. One warm introduction to a
              processor that adopts this is worth a recurring override on their entire activated
              book — for as long as those merchants sell. You never support anyone; the product and
              the processor do the work.
            </Card>
          </div>
        </section>

        {/* Links + CTA */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-20">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Poke around
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link href="/" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                The homepage
              </Link>{' '}
              <span className="text-zinc-500">— build a site as a guest, no account, see the product in 2 minutes</span>
            </li>
            <li>
              <Link href="/partners" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                /partners
              </Link>{' '}
              <span className="text-zinc-500">— the white-label program a processor would join</span>
            </li>
            <li>
              <Link href="/partners/calculator" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                /partners/calculator
              </Link>{' '}
              <span className="text-zinc-500">— drag the sliders, see the earnings curves at book scale</span>
            </li>
            <li>
              <Link href="/compare" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
                /compare
              </Link>{' '}
              <span className="text-zinc-500">— honest feature chart vs Duda / GoHighLevel</span>
            </li>
          </ul>

          <div className="mt-10 rounded-xl border border-sky-500/30 bg-sky-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">Got someone in mind?</p>
            <p className="mt-1 text-sm text-zinc-400">
              Text me their world (gateway? ISO? full-stack processor?) and I&apos;ll put together a
              one-pager for that specific conversation — including what the integration on their
              rails would look like.
            </p>
            <p className="mt-3 text-sm font-medium text-sky-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
