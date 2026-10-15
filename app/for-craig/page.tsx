// app/for-craig/page.tsx
//
// Personal, UNLISTED page for Craig Baker — on Vashon, a full-time job, weekends and after work
// free, said yes (FB Messenger, 2026-10-14) to printing flyers and handing them out at island
// restaurants and other businesses. The deal Sandon offered, in his words: an hourly rate for the
// time, "and ongoing commissions for any who sign up"; commissions auto-paid via Stripe, the hours
// paid via Stripe or Venmo; "I'll add a spot where you can enter your hours".
//
// Same pattern as /for-abdou: public URL, noindex, linked from nowhere; every dollar figure
// derived from a constant (the hourly rate from lib/rep/hours.ts, the share from the code's plan);
// the island list and the island sites READ LIVE. New here: the hours log (components/for-rep/
// hours-log.tsx) — he logs day, hours and where he went; Sandon marks rows paid on /admin/rep-hours.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { MAX_PLATFORM_FEE_PERCENT } from '@/lib/commerce/partner-terms';
import { mintRepActionToken } from '@/lib/rep/repActionToken';
import { repBuildLinks } from '@/lib/rep/repBuild';
import { moneyFromCents } from '@/lib/rep/hours';
import { loadHourly } from '@/lib/rep/hoursDb';
import { loadCityNoSite, loadCitySites, streetOf, tradeLabel } from '@/lib/rep/islandNoSite';
import { signInHref } from '@/lib/auth/authLinks';
import NoSiteTable, { type NoSiteRow as TableRow } from '@/components/for-rep/no-site-table';
import RestaurantsSection from '@/components/for-rep/restaurants-section';
import RepHoursSection from '@/components/for-rep/rep-hours-section';

export const dynamic = 'force-dynamic';

/** The vanity code's plan (referral_codes.plan.rate): the same lifetime terms as abdou/angela/ryan. */
const CODE = 'craig';
const CODE_RATE = 0.35;
const NAME = 'Craig';

const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const codePct = Math.round(CODE_RATE * 100);

/** Worked example — derived, never typed. */
const EX_ORDERS = 3000;
const EX_FEE = 0.05;
const exFee = EX_ORDERS * EX_FEE;
const exYours = exFee * CODE_RATE;
const money = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export const metadata: Metadata = {
  title: 'QuickSites — for Craig',
  description: 'Flyers on the island, paid by the hour, plus a share for life — for Craig.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

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

function Card({ title, tag, tone = 'zinc', children }: { title: string; tag?: string; tone?: 'zinc' | 'emerald' | 'sky' | 'rose' | 'amber'; children: React.ReactNode }) {
  const tones = {
    zinc: 'border-zinc-800 bg-zinc-900/40',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.05]',
    sky: 'border-sky-500/25 bg-sky-500/[0.04]',
    rose: 'border-rose-500/25 bg-rose-500/[0.04]',
    amber: 'border-amber-500/25 bg-amber-500/[0.05]',
  } as const;
  const tagTones = {
    zinc: 'border-zinc-700 bg-zinc-800 text-zinc-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  } as const;
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tagTones[tone]}`}>{tag}</span>}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

export default async function ForCraigPage() {
  const [island, sites, hourlyArr] = await Promise.all([loadCityNoSite('Vashon', 'WA'), loadCitySites('vashon'), loadHourly(CODE)]);
  // The hourly arrangement is a per-rep option on the code row (lib/rep/hours.ts); the page reads it,
  // never types it. If it is ever switched off, the rate card and the log disappear together.
  const hourlyOn = hourlyArr.enabled && hourlyArr.rateCents != null;
  const hourly = hourlyOn ? moneyFromCents(hourlyArr.rateCents as number) : null;
  const repToken = mintRepActionToken(CODE);
  const menuHost = process.env.NEXT_PUBLIC_MENU_BASE_DOMAIN || null;
  const tableRows: TableRow[] = island.rows.map((r) => {
    const slug = r.templates?.slug ?? null;
    const links = slug ? repBuildLinks({ slug, industryKey: r.industry_key, prospectId: r.id, code: CODE, menuHost }) : null;
    return {
      prospectId: r.id,
      businessName: (r.business_name ?? '').trim(),
      trade: tradeLabel(r.industry_key),
      phone: r.phone,
      street: streetOf(r.address, 'Vashon'),
      rating: r.rating,
      reviewCount: r.review_count,
      previewUrl: links?.previewUrl ?? null,
      claimUrl: links?.claimUrl ?? null,
    };
  });
  const sweptLabel = island.sweptOn ? new Date(island.sweptOn).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' }) : null;
  const kitHref = `/starter-kit/${CODE}?city=Vashon&region=WA&territory=Vashon%20Island`;

  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        {/* Hello */}
        <section className="relative mx-auto max-w-3xl px-6 pb-8 pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">Unlisted — just for you</span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Craig 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Here&apos;s the whole thing in one place, so you can work it on your own schedule — weekends, after work, whenever.{' '}
            <span className="text-zinc-200">
              Print the flyers, hand them to restaurants and any other business on the island, log your hours here, and keep a share of
              every order from anyone who signs up — for as long as they keep selling.
            </span>
          </p>
        </section>

        {/* The deal, in three lines */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {hourlyOn ? (
              <Card title="Your time" tag={`${hourly}/hr`} tone="amber">
                Log the hours below. Paid by Sandon, by Stripe or Venmo, whichever you prefer — not by the system.
              </Card>
            ) : (
              <Card title="Your time" tag="commission only" tone="zinc">
                No hourly arrangement is switched on for your code right now; the share below is the pay.
              </Card>
            )}
            <Card title="Your share" tag={`${codePct}% of the fee, for life`} tone="emerald">
              Any business that signs up through your flyer, link or code <code className="rounded bg-zinc-800 px-1 text-xs text-emerald-200">{CODE}</code> is tied to you from then on.
            </Card>
            <Card title="Your account" tag="sign in once" tone="sky">
              Sign in with <span className="text-zinc-200">craig27baker@gmail.com</span> and the code is already yours. Connect Stripe there once and commissions pay out automatically.
            </Card>
          </div>
        </section>

        {/* Hours — the shared section renders only while the code's hourly option is on */}
        <RepHoursSection code={CODE} repName={NAME} token={repToken} />

        {/* What to say */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">What you&apos;re handing out, and what to say</h2>
          <div className="mt-4 space-y-3">
            <Card title="1. Print the kit" tag="one click" tone="sky">
              <Link href={kitHref} className="text-sky-400 underline underline-offset-4">Your starter kit</Link> is a leave-behind flyer, business cards, and a
              &ldquo;your website is ready&rdquo; sheet for each island business we&apos;ve already built a site for — all carrying a QR code with your code
              in it. Type your phone number on that page before you print, if you want them to be able to reach you.
            </Card>
            <Card title="2. Hand it over, one sentence" tag="no pitch" tone="sky">
              <span className="text-zinc-200">
                &ldquo;I&apos;m handing these out for someone who makes e-commerce websites and used to live on the island — restaurants can take orders
                online through it, it&apos;s free to set up, there&apos;s a QR code if you want to look.&rdquo;
              </span>{' '}
              That is the whole thing. You are not selling; you are letting them know. If they ask what it costs: free to host, a small cut only when an
              order comes through it.
              <More label="If they want more">
                <p>
                  Restaurants: the site is their own menu, mobile-friendly, with online ordering — no app taking a third of the bill. Shops and makers: a
                  store page with checkout. Trades (plumbers, septic, electricians): a site named for the island and the trade that is meant to rank,
                  rented monthly once it does. You never have to explain any of it; the QR code lands them on a page that does.
                </p>
                <p>
                  Sandon&apos;s studio is Point Seven Studio; the product is QuickSites, and the restaurant side is delivered.menu. If someone wants to talk
                  to a person, they can text or call Sandon — the number is on the flyer once you add it, or they can use the contact form on the site.
                </p>
              </More>
            </Card>
            <Card title="3. Log the round, then forget about it" tag="your hours" tone="sky">
              When you get home, add the day, the hours and where you went in the log above. If a business signs up later, it shows on your dashboard; you
              don&apos;t chase anyone.
            </Card>
          </div>
        </section>

        {/* Restaurants: the shared section — walk in, drop a flyer; build their page from a row. */}
        <RestaurantsSection code={CODE} repName={NAME} token={repToken} prominent />

        {/* The island list */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Island businesses with no website{island.rows.length ? ` — ${island.rows.length} of them` : ''}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            {sweptLabel ? (
              <>Pulled from Google&apos;s own listings on {sweptLabel}: every business on Vashon and Maury that Google shows with a phone number and no website. </>
            ) : (
              <>The island hasn&apos;t been swept yet; this fills in automatically when it is. </>
            )}
            <span className="text-zinc-200">These are the best doors for a flyer. Press <em>Build their site</em> before you go in and you have something to show on your phone.</span>
          </p>
          {tableRows.length > 0 && (
            <div className="lg:-mx-32 xl:-mx-56">
              <NoSiteTable rows={tableRows} token={repToken} repName={NAME} />
            </div>
          )}
          <p className="mt-3 text-xs text-zinc-500">
            A listing here means Google shows no website for them today. Some will have a Facebook page or a site Google hasn&apos;t linked. Building takes
            about twenty seconds and costs nothing; every link it hands you carries your code.
          </p>
        </section>

        {/* The money */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">What the share is worth</h2>
          <div className="mt-4 space-y-4">
            <Card title="A share of every order, for life" tag={`${codePct}% of the fee`} tone="emerald">
              A business you bring in pays a platform fee on each online order (capped at {maxFeePct}%). {codePct}% of that fee is yours, on every order, for
              as long as they sell — written to your ledger the second the payment lands, refunds reversed, nothing hand-counted.
              <More label="A worked example">
                <p>
                  An island cafe does {money(EX_ORDERS)}/mo in online orders at a {Math.round(EX_FEE * 100)}% fee: {money(exFee)}/mo in fees,{' '}
                  <span className="text-emerald-300">{money(exYours)}/mo to you</span>, every month, for one flyer. A business that signs up and never takes
                  an order pays nothing — and earns you nothing. You earn when they do.
                </p>
              </More>
            </Card>
            <Card title="How the two payments reach you" tag="Stripe · Venmo" tone="amber">
              <span className="text-zinc-200">Commissions</span> accrue on your dashboard and transfer automatically once you connect a Stripe account there
              (about two minutes). <span className="text-zinc-200">Hours</span> are between you and Sandon: he reads the log above and pays the open rows by
              Stripe or Venmo, and marks them paid so you both see the same record.
            </Card>
          </div>
        </section>

        {/* Straight talk — read live */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Straight talk — what&apos;s real and what isn&apos;t yet</h2>
          <div className="mt-4 space-y-3">
            <Card title="The product is real and it works" tag="proven" tone="emerald">
              Real businesses run on it and checkout takes real money. The commission ledger is wired to the payment webhook; that part has been proven
              with simulated orders, not yet by a real referred sale.
            </Card>
            <Card title="Nobody has been paid a referral commission yet" tag="0 paid" tone="rose">
              The referral program is new; no referred business has yet taken a paid order, so the ledger that would pay you has never paid anyone. The
              hourly rate is the part that does not depend on that — it is paid for the time, whatever happens after.
            </Card>
            {sites.built > 0 ? (
              <Card
                title={sites.rented > 0 ? `${sites.built} island trade sites exist; ${sites.rented} rented` : `${sites.built} island trade sites exist; none has rented yet`}
                tag={`${sites.built} built · ${sites.rented} rented`}
                tone={sites.rented > 0 ? 'emerald' : 'rose'}
              >
                We hold {sites.built} vashon-<em>trade</em>.com sites, {sites.forwarding} of them forwarding calls to a real island business. Those are a
                conversation, not a flyer; the restaurants and shops are where a flyer earns.
              </Card>
            ) : (
              <Card title="No island trade sites yet" tag="0 built" tone="rose">
                Restaurants and shops are the flyer&apos;s job; the trade sites come later.
              </Card>
            )}
          </div>
        </section>

        {/* Start */}
        <section className="mx-auto max-w-3xl px-6 pb-20 pt-8">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-center">
            <p className="text-lg font-semibold text-white">This weekend</p>
            <p className="mt-1 text-sm text-zinc-400">Print the kit, pick a stretch of the highway or town, hand them out, log the hours. That&apos;s a round.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Link href={kitHref} className="inline-block rounded-lg bg-amber-500 px-6 py-3 text-base font-medium text-zinc-950 shadow-lg transition hover:bg-amber-400">
                Print my starter kit →
              </Link>
              <Link href={signInHref('/referrals/dashboard')} className="inline-block rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-200 transition hover:bg-zinc-800">
                Sign in to my dashboard
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-400">Questions, or want me to add hours for you — just message me. Thanks for doing this.</p>
            <p className="mt-3 text-sm font-medium text-amber-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
