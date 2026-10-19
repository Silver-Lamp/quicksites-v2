// app/for-katie/page.tsx
//
// Personal, UNLISTED page for Katie Bee — a professional organizer (ten years as a personal
// assistant and organizer in Texas) who moved to Vashon a month ago and posted in "Vashon for
// All" on 2026-10-19 looking for work: downsizing & decluttering for homes, offices, digital,
// creative spaces, workshops, moving. Sandon's read (same morning): build her a spec site with
// booking and payments, and — because she works with small businesses, nonprofits, farmers,
// artists and neurodivergent folks — she is a natural referrer for both QuickSites and
// HiveJournal's family surface.
//
// Same pattern as /for-amber and /for-craig: public URL, noindex, linked from nowhere. First
// name only. Every money figure DERIVED from a constant (the code's plan, the platform fee cap);
// nothing about HiveJournal's programme carries a number, because those are HJ's to state. The
// site was built from her own words and nothing else; the page says what is NOT on it as
// plainly as what is. The claim link is never printed here — it is a bearer credential and
// travels by private message only (memory: build-from-post).
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import RepHoursSection from '@/components/for-rep/rep-hours-section';
import NoSiteSection from '@/components/for-rep/no-site-section';
import { MAX_PLATFORM_FEE_PERCENT } from '@/lib/commerce/partner-terms';
import { territoryFor } from '@/lib/rep/territories';
import { mintRepActionToken } from '@/lib/rep/repActionToken';
import { signInHref } from '@/lib/auth/authLinks';

export const metadata: Metadata = {
  title: 'For Katie',
  description: 'A site built from your post, booking and payments through it, and two ways to send people our way.',
  robots: { index: false, follow: false },
};

/** Her referral code (referral_codes, minted 2026-10-19 on the island terms: plan.rate 0.35, lifetime). */
const REF_CODE = 'katie';
const REF_RATE = 0.35;
const refPct = Math.round(REF_RATE * 100);
const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);

/** The site built from her post (scripts/_scratch/katie-build.mts, 2026-10-19). */
const SITE_SLUG = 'katie-bee-organizing-glfkf';
const SITE_PATH = `/sites/${SITE_SLUG}`;
/** Her six categories, exactly as the flyer listed them. */
const CATEGORIES = ['Home', 'Office', 'Digital', 'Art / creative spaces', 'Tools / workshops', 'Moving / packing'];

function Card({ title, tag, tone = 'zinc', children }: { title: string; tag?: string; tone?: 'zinc' | 'emerald' | 'sky' | 'rose' | 'amber'; children: React.ReactNode }) {
  const tones = {
    zinc: 'border-zinc-800 bg-zinc-900/40',
    emerald: 'border-emerald-500/25 bg-emerald-500/[0.05]',
    sky: 'border-sky-500/25 bg-sky-500/[0.04]',
    rose: 'border-rose-500/25 bg-rose-500/[0.04]',
    amber: 'border-amber-500/30 bg-amber-500/[0.05]',
  } as const;
  const tagTones = {
    zinc: 'border-zinc-700 bg-zinc-800 text-zinc-300',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-300',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  } as const;
  return (
    <div className={`rounded-xl border p-5 ${tones[tone]}`}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {tag && <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tagTones[tone]}`}>{tag}</span>}
      </div>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-zinc-400">{children}</div>
    </div>
  );
}

// Live reads (the hours option, the no-website list) — render per request.
export const dynamic = 'force-dynamic';

export default async function ForKatiePage() {
  const repToken = mintRepActionToken(REF_CODE);
  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pb-8 pt-16">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute -top-20 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-amber-500/10 blur-3xl" />
          </div>
          <span className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-xs font-medium text-zinc-400">Unlisted — just for you</span>
          <h1 className="mt-6 text-4xl font-extrabold tracking-tight md:text-5xl">Hey Katie 👋</h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-400">
            Sandon saw your post in Vashon for All this morning and asked me to put three things in one place: a website
            built from your own words, the booking and payments it can take for you, and a way to be paid for sending
            people our way. <span className="text-zinc-200">Nothing here is set up in your name without you.</span>
          </p>
        </section>

        {/* The rule, first */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <Card title="Read this part first" tag="plain words" tone="rose">
            <p>
              The site below is a draft, built from your post and the flyer in it and nothing else. It is not published
              anywhere people search, it carries no prices or hours because you posted none, and it is yours to take
              over or to delete. If you would rather it did not exist, say so and it comes down the same day.
            </p>
          </Card>
        </section>

        {/* The site */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Your site, built from your post</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="What is on it" tag="your words only" tone="emerald">
              <p>
                Your headline (<em>Need to get organized?</em>), what you wrote about your work, your number, and the six
                things your flyer lists:
              </p>
              <ul className="list-disc pl-5">
                {CATEGORIES.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <p>
                <Link href={SITE_PATH} className="font-semibold text-emerald-300 underline underline-offset-4" target="_blank" rel="noreferrer">
                  Open the draft
                </Link>
              </p>
            </Card>
            <Card title="What is not on it, on purpose" tag="honest" tone="zinc">
              <p>
                No prices, no hours, no photos, no testimonials, no claims about response times or guarantees. Those are
                yours to add, in your own words, once it is your account. The name on it — <em>Katie Bee Organizing</em> —
                is just your name and what you do; change it to whatever you call the business.
              </p>
              <p>Sandon has a private link that makes it your account. It is not printed here because it is yours alone.</p>
            </Card>
          </div>
        </section>

        {/* Booking + payments */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Booking and getting paid, through the site</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="Book a time with Katie" tag="on the draft now, as a preview" tone="sky">
              <p>
                A client picks a day and a time, leaves a name and a number, and gets a confirmation with a calendar
                file. You get an email, and a bookings page on your phone with the day's list, where you can add one
                someone booked by text, or cancel.
              </p>
              <p>
                You set the hours you take bookings, how long a session is, and how much notice you need. Until you claim
                the site and set them, the widget runs as a <em>preview</em>: the times it shows are placeholders and
                nothing is recorded — it says so on the page.
              </p>
            </Card>
            <Card title="Getting paid" tag="your Stripe, your bank" tone="emerald">
              <p>
                From your dashboard you connect a Stripe account in your own name — the money goes to your bank, never
                through ours. Then you list what you sell at prices you set: an initial visit, a half day, a packing
                day, a digital declutter. Clients pay by card on the site and you see every order.
              </p>
              <p>
                QuickSites keeps at most {maxFeePct}% of an order that goes through the site, and nothing otherwise. No
                monthly fee, no setup fee, no charge for having the site. Stripe takes its own card fee on each payment;
                that one is theirs.
              </p>
            </Card>
          </div>
          <div className="mt-3">
            <Card title="What it does not do yet" tag="said plainly" tone="rose">
              <p>
                Sending a client a bill <em>after</em> a job — “six hours on Tuesday, here is what you owe” — is not on the
                site today. It takes payment for things you list up front. If after-the-fact invoicing is what you need
                most, tell Sandon; it would be the next thing built, and you would be the reason.
              </p>
            </Card>
          </div>
        </section>

        {/* Referrals — QuickSites */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Send people our way — QuickSites</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            You wrote that you have worked with small business owners, nonprofits, farmers and artists. A good number of
            them, here and anywhere, have no website at all. QuickSites gives a local business a proper site for free — a
            shop gets a store, a service business gets a page with booking like yours, a restaurant gets online ordering —
            and earns only a small cut when an order actually goes through it. You never sell anything; you mention it
            when someone says they need a website.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="Your code" tag={`${refPct}% of the fee, for life`} tone="sky">
              <p>
                Anyone who signs up with the code <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-sm font-semibold text-sky-200">{REF_CODE}</code>{' '}
                — or through <span className="font-mono text-zinc-200">www.quicksites.ai/?ref={REF_CODE}</span> — is tied to
                you from then on. {refPct}% of the platform fee on every order that business ever takes through its site
                is yours, for as long as it keeps selling, credited automatically when the payment lands. The same terms
                every island referrer has.
              </p>
              <p>
                To attach it to you, <Link href={signInHref()} className="underline underline-offset-4">sign in</Link> with
                the email you want paid at and tell Sandon which one; the code is already live.
              </p>
            </Card>
            <Card title="Two things we ask" tag="the rules" tone="amber">
              <p>
                Say that you get a share when you recommend it — a plain “I get a small cut if you sign up through me”
                is enough, and it is the law as well as our rule. And only mention it to someone who actually asked
                about a website; we would rather have no referral than a pushed one.
              </p>
              <p>
                The programme is young and you would be early. Nothing to buy, no quota, and you can stop any time.
              </p>
            </Card>
          </div>
        </section>

        {/* Referrals — HiveJournal */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-10">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">Send people our way — HiveJournal, for homes and families</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-400">
            Sandon's other company, HiveJournal, makes a family surface it calls Cornerstone: a shared screen in the
            kitchen, on any old iPad, that holds the household's routines, chores, a map of the house with what needs
            doing and when it was last done, and a planner for the day. It is the kind of order you set up in a home,
            kept up after you leave — which is why he thinks the families and neurodivergent folks you work with would
            take to it, and why he wanted you to know it exists before you recommend anything.
          </p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Card title="How that one works" tag="theirs, not ours" tone="sky">
              <p>
                HiveJournal runs its own referral programme with its own terms, and they are HiveJournal's to state, so
                there are no figures on this page about it. Sandon will introduce you; they set up your code there, and
                it is the same honest rule — say you get a share, mention it only when it fits.
              </p>
              <p>
                <a href="https://hivejournal.com/family" className="font-semibold text-sky-300 underline underline-offset-4" target="_blank" rel="noreferrer">
                  See what it is
                </a>
              </p>
            </Card>
            <Card title="Why you, in his words" tag="the fit" tone="zinc">
              <p>
                “She works with a lot of people” — and the people she works with are exactly who both products are for:
                a small business that needs a site, and a household that needs the order she just built to stay built.
              </p>
            </Card>
          </div>
        </section>

        {/* Mounted on every rep page: the hours log renders only when the option is on; the live no-website list by territory. */}
        <RepHoursSection code={REF_CODE} repName="Katie" token={repToken} />
        <NoSiteSection code={REF_CODE} repName="Katie" token={repToken} territory={territoryFor(REF_CODE)} />

        <section className="mx-auto max-w-3xl px-6 pb-20 pt-8">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <p className="text-sm leading-relaxed text-zinc-400">
              If you'd rather not be part of any of this, say so and that's the end of it — the draft and this page come
              down, no awkwardness. If you're curious, the draft is the only thing to look at, and your phone is the only
              thing anyone is asking you to pick up.
            </p>
            <p className="mt-3 text-sm font-medium text-amber-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
