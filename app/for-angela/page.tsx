// app/for-angela/page.tsx
//
// Personal, UNLISTED page for Angela: a way to earn supplemental income from the people she
// already meets, in the downtime her event work already has. Public URL, noindex, linked from
// nowhere — share the link directly. Same pattern as /for-ryan (native <details>, no JS).
//
// Money on this page comes from lib/commerce/partner-terms + lib/commerce/rentalSplits, and the
// vanity code `angela` was minted on the same terms as `ryan` (35% of the platform fee, lifetime).
// The "straight talk" section is load-bearing: this is written for someone who needs the income
// to be real, so the page says what has and has not happened rather than what could.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT } from '@/lib/commerce/partner-terms';
import { SPLIT } from '@/lib/commerce/rentalSplits';

/** The vanity code's plan (lib/referrals/codes.ts → referral_codes.plan.rate). Same as ryan/daniel. */
const CODE = 'angela';
const CODE_RATE = 0.35;

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const codePct = Math.round(CODE_RATE * 100);
const closerPct = Math.round(SPLIT.closer * 100);

/** Worked examples — every figure derived here, never typed. */
const EX_ORDERS = 4000; // a busy small restaurant's monthly online orders
const EX_FEE = 0.05; // a typical platform fee (cap is MAX_PLATFORM_FEE_PERCENT)
const exFee = EX_ORDERS * EX_FEE;
const exYours = exFee * CODE_RATE;
const RENT = 99; // /for-sales: the rental price today; steps to $399 on page one
const rentYours = RENT * SPLIT.closer;

export const metadata: Metadata = {
  title: 'QuickSites — for Angela',
  description: 'A side income from the people you already talk to, in the downtime you already have — for Angela.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

function More({ label = 'How it actually works', children }: { label?: string; children: React.ReactNode }) {
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
  tone = 'zinc',
  children,
  more,
}: {
  title: string;
  tag?: string;
  tone?: 'zinc' | 'emerald' | 'sky' | 'rose';
  children: React.ReactNode;
  more?: React.ReactNode;
}) {
  const tones = {
    zinc: 'border-zinc-800 bg-zinc-900/40',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.05]',
    sky: 'border-sky-500/25 bg-sky-500/[0.04]',
    rose: 'border-rose-500/25 bg-rose-500/[0.04]',
  } as const;
  const tagTones = {
    zinc: 'border-zinc-700 bg-zinc-800 text-zinc-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
  } as const;
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tagTones[tone]}`}>{tag}</span>}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      {more && <More>{more}</More>}
    </div>
  );
}

const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export default function ForAngelaPage() {
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hello */}
        <section className="relative mx-auto max-w-3xl px-6 pb-10 pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">
            Unlisted — just for you
          </span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Angela 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            You make friends everywhere we go. Restaurant owners, the caterer at the last event, the
            florist, the AV guy, half the practices in the building — you know them, and they like
            you. This page is one idea:{' '}
            <span className="text-zinc-200">
              that habit could pay you a little every month, and you could build it in the time you
              already spend waiting around at events.
            </span>
          </p>
          <p className="mt-3 text-sm text-zinc-500">
            No inventory, nothing to buy, no quota. The only thing it takes is what you already do:
            talk to people. And with your oldest heading off to college next year, it could grow
            into something more when you have the evenings for it.
          </p>
        </section>

        {/* The one-liner */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6">
            <h2 className="text-lg font-bold text-white">What QuickSites is, in one breath</h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              We give local businesses a real website for free — a restaurant gets an online-ordering
              site, a shop gets a store, a service business gets a page that ranks — and we earn a
              small cut only when they actually take an order through it.{' '}
              <span className="text-zinc-100">
                When you're the reason they signed up, a share of that cut is yours, every month, for
                as long as they keep selling.
              </span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              So you never have to sell anything. You point a business you like at something free
              that helps them, and if it works for them, it works for you too.
            </p>
          </div>
        </section>

        {/* Your code */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <div className="rounded-2xl border border-sky-500/30 bg-sky-500/[0.05] p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-bold text-white">Your code is already live</h2>
              <span className="shrink-0 rounded-full border border-sky-500/40 bg-sky-500/10 px-2.5 py-0.5 text-[11px] font-medium text-sky-300">
                {codePct}% of the fee, for life
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-300">
              Anyone who signs up with the code{' '}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold text-sky-200">{CODE}</code>{' '}
              — or through your link — is tied to you from then on:
            </p>
            <div className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-200">
              www.quicksites.ai/?ref={CODE}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Every paid order that business ever processes credits you {codePct}% of the platform fee
              — automatically, at the moment the payment lands, refunds reversed. Nothing is
              hand-counted and nothing needs turning on. You don't support them; the product does.
            </p>
            <More label="How you get paid">
              <p>
                Your share accrues from the first order whether or not you've set up payouts. When
                you're ready, you connect a Stripe account once (about two minutes, from your partner
                dashboard) and everything accrued transfers to you; after that it transfers as sales
                happen. The dashboard shows referred businesses, per-order commissions, paid and owed.
              </p>
            </More>
          </div>
        </section>

        {/* The downtime workflow */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            The part built for your downtime
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Waiting at the airport for an exec's flight. Sitting in a hotel lobby while the sessions
            run. That's the exact shape of this: ten-minute chunks, phone in hand, no laptop needed.
          </p>
          <div className="mt-4 space-y-3">
            <Card title="1. Build them a site before you ever mention it" tag="20 seconds" tone="sky">
              Go to <span className="text-zinc-200">quicksites.ai/rebuild</span>, paste a business's
              current website (or their Google listing), and it builds a new site from their own words
              and photos — a preview link you can text them. No account, no cost. You're not asking
              them to imagine it; you're showing them theirs.
              <More>
                <p>
                  It reads their existing site (menu, services, photos, hours), writes fresh copy, and
                  drops it in an editor with a <em>Preview</em> button. For a restaurant it becomes an
                  ordering site; for a store it reads their products. If their site is thin, the
                  draft will be too — pick businesses whose current site has real content.
                </p>
                <Example>
                  The caterer from last week's event has a 2019 website. At the airport you paste it
                  in, get the preview, and text: "Saw your site — built you a fresher one, no charge,
                  take a look." That's the whole pitch. If they want it, they sign up with your code.
                </Example>
              </More>
            </Card>
            <Card title="2. Keep a list, not a script" tag="your phone's notes" tone="sky">
              Every event, every practice, every restaurant you love: one line each — who, what they
              sell, whether they take orders online. Downtime is for working the list, not for cold
              calls. Warm intros only; you never talk to a stranger about this.
            </Card>
            <Card title="3. Send the link, then leave it alone" tag="no chasing" tone="sky">
              One text with the preview and your link. If they sign up, you'll see it on your
              dashboard. If they don't, nothing lost — you were never selling. The businesses that
              say yes are the ones that already wanted a better site.
            </Card>
          </div>
        </section>

        {/* Who in your world */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Who in your world this fits
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🍽️ Restaurants and caterers</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                The best fit by far: they take orders, and an ordering site is exactly what we build.
                Every place you eat, every caterer you've worked an event with.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🎪 Event vendors</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                Florists, photographers, AV and rental companies, bakers — people who sell packages
                and take deposits. You meet a dozen of them a month already.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🦷 The practices and the people in them</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                A practice itself doesn't sell online, but the hygienist with an Etsy shop, the front
                desk's husband with the food truck, the patient who owns the taqueria — that's your
                network, and it's huge.
              </p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
              <h3 className="text-sm font-semibold text-white">🔧 Local trades</h3>
              <p className="mt-1.5 text-sm text-zinc-400">
                Towing, plumbing, roofing — a different model (below), and a different conversation:
                "want to rent the site that already ranks for your town?"
              </p>
            </div>
          </div>
        </section>

        {/* The money */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">What it pays</h2>
          <div className="mt-4 space-y-4">
            <Card title="Referrals — a share of every order, for life" tag={`${codePct}% of the fee`} tone="emerald">
              A business you refer pays a platform fee on each online order (capped at {maxFeePct}%).
              {' '}{codePct}% of that fee is yours, on every order, for as long as they sell.
              <More>
                <Example>
                  A taqueria you love does {money(EX_ORDERS)}/mo in online orders at a{' '}
                  {Math.round(EX_FEE * 100)}% fee. That's {money(exFee)}/mo in fees —{' '}
                  <span className="text-emerald-300">{money(exYours)}/mo to you</span>, every month, for
                  one text message. Ten places like it is {money(exYours * 10)}/mo that doesn't care
                  which airport you're sitting in.
                </Example>
                <p>
                  The size of it tracks how much they sell online, so restaurants and food businesses
                  pay best. A business that signs up and never takes an order pays nothing — and earns
                  you nothing. That's the honest shape: you earn when they do.
                </p>
              </More>
            </Card>

            <Card title="Rentals — half the rent on a ranking site" tag={`${closerPct}% of net`} tone="emerald">
              For trades we own sites like <span className="text-zinc-200">boston-towing.com</span> that
              already rank for their town. A towing company rents it for {money(RENT)}/mo;{' '}
              <span className="text-emerald-300">{money(rentYours)}/mo of that is yours</span>, for as
              long as they keep it. When a site reaches page one the rent steps to $399, and your half
              steps with it.
              <More>
                <p>
                  This one is more of a conversation than a text — it's a business paying monthly for
                  something, so they'll have questions. The full brief, including what a call sounds
                  like, is at <Link href="/for-sales" className="text-sky-400 underline underline-offset-4">/for-sales</Link>.
                  Start with referrals; come to this if you find you enjoy the calls.
                </p>
              </More>
            </Card>
          </div>
        </section>

        {/* Straight talk */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Straight talk — what's real and what isn't yet
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            You'd be counting on this, so you get the whole picture, not the brochure.
          </p>
          <div className="mt-4 space-y-3">
            <Card title="The product is real and it works" tag="proven" tone="emerald">
              Real businesses run on it and checkout takes real money — proven with real cards. The
              commission ledger is wired to the payment webhook, so when a referred order is paid the
              referrer's share is written the same second; that part has been proven with simulated
              orders, not yet by a real referred sale (next card).
            </Card>
            <Card title="Nobody has been paid a referral commission yet" tag="0 paid" tone="rose">
              The referral program is new. The mechanism has been tested end to end, but no referred
              business has yet taken a paid order, so the ledger that would pay you has never paid
              anyone. You would be early — which is why the terms are as generous as they are.
            </Card>
            <Card title="Rentals: the sites rank, none has rented" tag="0 rented" tone="rose">
              The trade sites hold real search positions and the checkout bills correctly (proven with
              a real card), but no business has rented one yet, and the one person who tried selling
              them made four calls and stopped. That lane is unproven. Referrals are the safer start.
            </Card>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-zinc-400">
            What that means in practice: treat the first few months as{' '}
            <span className="text-zinc-200">finding out how many of your people say yes</span>, not as
            income you can plan around. If three of them do and one takes orders, you'll see the
            first real dollars — and then you'll know what a year of your list is worth.
          </p>
        </section>

        {/* Start */}
        <section className="mx-auto max-w-3xl px-6 pb-20 pt-8">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">Want to try it this week?</p>
            <p className="mt-1 text-sm text-zinc-400">
              Three steps, all from your phone: sign up (your code{' '}
              <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-xs text-emerald-200">{CODE}</code> is
              waiting to be claimed), build one site for someone you like at{' '}
              <span className="text-zinc-200">quicksites.ai/rebuild</span>, and text them the preview.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link
                href="/partners/dashboard"
                className="inline-block rounded-lg bg-emerald-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-emerald-400"
              >
                Claim my code →
              </Link>
              <Link
                href="/rebuild"
                className="inline-block rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                Build someone a site
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              Or just text me and I'll walk you through the first one. It's genuinely a ten-minute
              thing, and you're better at the people part than I am.
            </p>
            <p className="mt-3 text-sm font-medium text-emerald-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
