// app/for-daniel/page.tsx
// Personal, UNLISTED orientation page for Daniel (majority owner of DeckSketch).
// Not a reseller pitch — it's the picture of how the QuickSites↔DeckSketch
// integrations we've shipped compound DeckSketch's business: every deck-builder
// website QuickSites makes becomes a live front door for DeckSketch's estimating
// engine, and QuickSites' discovery/outreach engine becomes a builder-acquisition
// channel that feeds DeckSketch usage. Public URL, noindex, linked from nowhere.
//
// Honesty rules for this page: claims about what's BUILT are limited to seams that
// are actually LIVE + prod-verified (crosstalk/contracts/{deck,quote}-estimate-embed.md,
// verified 2026-07-17). Dollar figures are clearly-hypothetical "Example" framing, never
// presented as DeckSketch's real numbers.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';

export const metadata: Metadata = {
  title: 'QuickSites × DeckSketch — for Daniel',
  description: 'How the QuickSites integrations grow DeckSketch.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

/** Native-details expander — server-rendered, zero JS. */
function More({ label = 'More detail', children }: { label?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-lg border border-zinc-800/80 bg-zinc-950/40">
      <summary className="flex cursor-pointer select-none items-center gap-2 px-3 py-2 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        {label}
      </summary>
      <div className="space-y-3 px-4 pb-4 pt-1 text-sm leading-relaxed text-zinc-400">
        {children}
      </div>
    </details>
  );
}

function Example({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-sm leading-relaxed text-zinc-400">
      <span className="mr-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-400">
        Example
      </span>
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
          <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
            {tag}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      {more && <More label={moreLabel}>{more}</More>}
    </div>
  );
}

export default function ForDanielPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pt-16 pb-10">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
            Unlisted — just for you
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Daniel 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Quick picture of what the QuickSites side is doing for DeckSketch. Short version:{' '}
            <span className="text-zinc-200">
              every website we build for a deck builder becomes a live front door for
              DeckSketch&apos;s estimating engine
            </span>
            , and our lead-gen machine turns into a way to put DeckSketch in front of builders
            who&apos;ve never heard of it. The seams are already shipped and running in production —
            cards expand if you want the gears.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            The frame I care about: DeckSketch has the hard, valuable thing — the math (BOM engine +
            per-trade pricing models). QuickSites has distribution (free sites + a
            discovery/outreach engine that acquires the businesses that need that math). Bolted
            together, each one makes the other worth more.
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            First though — the thing I texted you about: your referral code. It&apos;s set up and
            live right now. 👇
          </p>
        </section>

        {/* Your referral code — the timely action item */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Your referral code</h2>
              <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-300">
                lifetime residual
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              If you ever mention QuickSites to anyone, just tell them to use the code{' '}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold text-amber-200">
                daniel
              </code>{' '}
              when they sign up — or send them your link:
            </p>
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200">
              www.quicksites.ai/?ref=daniel
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Anyone who signs up under it is tied to you, and you earn a{' '}
              <span className="text-zinc-200">
                lifetime share of what QuickSites earns on their orders
              </span>{' '}
              — for as long as their account lives, not just year one. As a founding partner
              you&apos;re locked in at the top rate. It&apos;s already recording signups, so
              there&apos;s nothing to &ldquo;turn on.&rdquo; Your exact cut + projections are on the
              dashboard below — I&apos;d rather you see live numbers than a number on a page.
            </p>

            <More label="How you get paid (and the escrow bit)">
              <p>
                You don&apos;t need Stripe set up to start — the code accrues your earnings the
                whole time. When you connect Stripe Connect, anything that&apos;s accrued since we
                started gets transferred to you at that point. If you&apos;re already connected when
                a sale happens, your cut transfers at the time of that sale. Until then it&apos;s
                simply held for you (I see a &ldquo;held&rdquo; balance on my side; you&apos;ll see
                it on your dashboard).
              </p>
              <p>
                Mechanically: I minted the code before you even had an account, so the moment you
                sign up with your email it links to you automatically, and I finalize it on my end.
                Nothing to chase.
              </p>
            </More>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              <Link
                href="/referrals/dashboard"
                className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 font-medium text-amber-200 hover:bg-amber-500/20"
              >
                Your earnings dashboard →
              </Link>
              <Link
                href="/partners/calculator"
                className="rounded-lg border border-zinc-700 px-4 py-2 text-zinc-200 hover:bg-zinc-800"
              >
                Potential earnings calculator
              </Link>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              (The dashboard fills in once you&apos;ve signed in with the email this is set up for —
              it shows signups, what&apos;s held, and what&apos;s been paid.)
            </p>
          </div>
        </section>

        {/* The core seam */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            What&apos;s live between the two products
          </h2>
          <div className="mt-4 space-y-4">
            <Card
              title="Every deck-builder site is a DeckSketch demo in front of a real homeowner"
              tag="live · prod-verified"
              moreLabel="How the estimate seam works"
              more={
                <>
                  <p>
                    A deck builder&apos;s free QuickSites site carries an{' '}
                    <em>instant deck estimate</em> widget. A homeowner types a few dimensions and
                    gets a ballpark price range on the spot — and that range is computed by{' '}
                    <span className="text-zinc-300">DeckSketch&apos;s BOM engine</span> (materials
                    takeoff + per-vendor price books), not some throwaway formula. QuickSites
                    proxies your{' '}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      /api/estimate
                    </code>{' '}
                    server-to-server and renders its own UI, so your endpoint stays off the public
                    browser surface. One config value points at your host, so your move to{' '}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      app.decksketch.ai
                    </code>{' '}
                    is a single edit on our side, not a code change.
                  </p>
                  <p>
                    It went in as a stateless, PII-free contract and was prod-verified on 2026-07-17
                    (real requests returning real ranges). The point: DeckSketch&apos;s accuracy
                    gets exercised against live homeowner demand it wasn&apos;t reaching before.
                  </p>
                </>
              }
            >
              The homeowner-facing estimate on a builder&apos;s site is powered by DeckSketch&apos;s
              engine. Every one of those sites is DeckSketch&apos;s math doing real work in front of
              a buyer — with your brand as the eventual destination.
            </Card>

            <Card
              title="Those homeowner estimates are qualified leads → the natural upgrade into DeckSketch"
              tag="funnel"
              more={
                <>
                  <p>
                    The estimate is deliberately a <em>ballpark</em>. The homeowner who gets one and
                    wants to go further is a warm, high-intent lead — and the obvious next step is
                    the real thing: DeckSketch&apos;s actual canvas / itemized design (the
                    &ldquo;design it&rdquo; tier). So QuickSites isn&apos;t just showing
                    DeckSketch&apos;s number; it&apos;s manufacturing the exact demand that pulls
                    people into DeckSketch&apos;s core product.
                  </p>
                  <p>
                    Lead ownership is settled and clean: the site belongs to the deck builder (our
                    customer), so the homeowner&apos;s contact info goes to the <em>builder</em> via
                    QuickSites&apos; hardened submission rail. The estimate endpoint never touches
                    PII. Nobody&apos;s stepping on anybody&apos;s customer.
                  </p>
                </>
              }
            >
              A ballpark that lands creates a homeowner who wants a real plan — and a builder who
              wants to deliver one. That&apos;s the on-ramp into DeckSketch&apos;s paid design flow,
              generated for free by sites we&apos;re already giving builders.
            </Card>

            <Card
              title="Our discovery + outreach engine becomes a builder-acquisition channel for DeckSketch"
              tag="distribution"
              moreLabel="The acquisition machine"
              more={
                <>
                  <p>
                    QuickSites already runs a growth engine that sweeps a metro, finds every
                    business with <em>no website</em>, and pre-builds working sites for them before
                    first contact — then pitches them via exact-match geo domains (think{' '}
                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-300">
                      &lt;city&gt;-deck-builders.com
                    </code>
                    ).{' '}
                    <span className="text-zinc-300">
                      Deck builder is a first-class vertical in that engine.
                    </span>{' '}
                    Every builder we sign gets a site with the DeckSketch estimate widget baked in
                    from day one.
                  </p>
                  <p>
                    Translation for DeckSketch: we do the cold customer acquisition — the part
                    that&apos;s expensive and slow — and each builder we land shows up already
                    running DeckSketch estimates. You get top-of-funnel distribution to a trade
                    that&apos;s notoriously hard to reach online, without spending your own
                    acquisition dollars.
                  </p>
                  <Example>
                    We sweep a metro and pre-build 40 no-website deck builders&apos; sites, each
                    with the estimate widget live. Even a fraction of those going active is that
                    many new builders putting DeckSketch&apos;s engine in front of their homeowners
                    — a distribution surface DeckSketch didn&apos;t have to build or buy.
                  </Example>
                </>
              }
            >
              QuickSites finds and onboards the deck builders; each one arrives with DeckSketch
              already wired in. It&apos;s a builder-acquisition channel for DeckSketch that runs on
              QuickSites&apos; dime.
            </Card>

            <Card
              title="The estimator now spans 9 trades — DeckSketch as the engine behind every high-ticket outdoor job"
              tag="TAM expansion"
              moreLabel="Beyond decks"
              more={
                <>
                  <p>
                    We generalized the deck seam into one multi-trade endpoint: deck plus fence,
                    concrete patio, turf, epoxy floor, paving, roofing, siding, and retaining wall —
                    nine trades, each a real DeckSketch parametric model, all merged and
                    prod-verified on 2026-07-17. Same one endpoint, one proxy, one attribution key.
                  </p>
                  <p>
                    Why it matters for DeckSketch: it reframes the company from &ldquo;a deck design
                    tool&rdquo; to{' '}
                    <span className="text-zinc-300">
                      the estimating engine for high-ticket contracting
                    </span>
                    . And QuickSites is effectively a live test harness proving demand for each new
                    trade&apos;s model — in front of real buyers — before DeckSketch invests in a
                    full UI for it. The go-to-market is deliberately fence-first behind deck; the
                    other trades are live but unforced.
                  </p>
                </>
              }
            >
              Decks were the wedge. The same DeckSketch-powered estimate now covers nine trades, so
              DeckSketch&apos;s math becomes the pricing engine behind far more than decks — with
              QuickSites validating demand for each trade before you build UI around it.
            </Card>
          </div>
        </section>

        {/* Why the shape is good for DeckSketch specifically */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Why this shape is good for DeckSketch specifically
          </h2>
          <div className="mt-4 space-y-4">
            <Card
              title="DeckSketch keeps the moat; QuickSites carries the distribution cost"
              tag="clean split"
              more={
                <>
                  <p>
                    The valuable, defensible asset stays yours — the estimating math, the price
                    books, the design canvas. QuickSites takes on the unglamorous, capital-intensive
                    half: acquiring the builders, hosting their sites, running the submission rail.
                    The integration was architected so neither product owns the other&apos;s
                    customer (builder owns the lead, PII-free estimate endpoint, per-site
                    attribution), which keeps the relationship durable instead of tangled.
                  </p>
                </>
              }
            >
              You keep the hard, high-value part. We eat the cost of getting it in front of demand.
              The seams are built so that stays true as it scales.
            </Card>

            <Card
              title="It's already running, not a slide"
              tag="shipped"
              more={
                <>
                  <p>
                    None of the above is a roadmap. The deck estimate seam is live and
                    prod-verified; the 9-trade endpoint is merged and verified; deck builder is a
                    live QuickSites vertical with geo-domain outreach and lead capture wired end to
                    end. The remaining knobs are calibration on your side (e.g.
                    installed-vs-materials pricing is a coefficient version on DeckSketch, not a
                    QuickSites change) — which is exactly the kind of thing live QuickSites traffic
                    can help you tune.
                  </p>
                </>
              }
            >
              This is in production today. The open items are DeckSketch-side calibration decisions,
              and QuickSites&apos; live homeowner traffic is a useful signal for making them.
            </Card>
          </div>
        </section>

        {/* Poke around + CTA */}
        <section className="mx-auto max-w-3xl px-6 pt-10 pb-20">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Poke around
          </h2>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link
                href="/"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
              >
                The homepage
              </Link>{' '}
              <span className="text-zinc-500">
                — build a site as a guest, no account, to see what a deck builder gets in ~2 minutes
              </span>
            </li>
            <li>
              <Link
                href="/partners"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
              >
                /partners
              </Link>{' '}
              <span className="text-zinc-500">
                — how QuickSites monetizes (the fee-per-order model)
              </span>
            </li>
            <li>
              <Link
                href="/compare"
                className="text-amber-400 underline underline-offset-4 hover:text-amber-300"
              >
                /compare
              </Link>{' '}
              <span className="text-zinc-500">
                — where QuickSites sits vs the website incumbents
              </span>
            </li>
          </ul>

          <div className="mt-10 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">Where I want your take</p>
            <p className="mt-1 text-sm text-zinc-400">
              The two big DeckSketch-side calls are (1) whether to lean into the non-deck trades as
              a real product surface, not just an API, and (2) the installed-vs-materials pricing
              default. Both change how aggressively QuickSites can push builders at DeckSketch.
              Let&apos;s pick a time and go through it.
            </p>
            <p className="mt-3 text-sm font-medium text-amber-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
