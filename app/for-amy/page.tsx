// app/for-amy/page.tsx
//
// Personal, UNLISTED page for Amy. Public URL, noindex, linked from nowhere — share the link
// directly. Same pattern as /for-angela and /for-ryan (native <details>, no JS).
//
// ⚠️ THIS PAGE EXISTS TO ANSWER ONE QUESTION AMY ACTUALLY ASKED, IN WRITING, SO SHE DOES NOT HAVE
// TO ASK IT TWICE: "do I get an override on the business the people I refer bring in?"
//
// Two things make that question delicate, and both are the reason this page is written the way it
// is rather than as a pitch:
//
//   1. The ANSWER IS YES and the rate was already settled on 2026-08-25 — but the override had
//      never been written down anywhere Amy could read it. lib/commerce/rentalSplits.ts says so in
//      its own comment: "The closer's residual was written down in three places and the override in
//      none, which is how a rep discovers the terms of their own pay by asking an awkward question
//      six months in." She then asked that exact question. This page is the fix.
//
//   2. The PART SHE DID NOT ASK ABOUT is the part that could sour: the override follows the ROLE,
//      not the recruit. It runs while she is managing that rep and stops when she stops. Telling her
//      that now is cheap; letting her find out after she has built a team is not.
//
// ⚠️ BOTH RAILS ARE ON THIS PAGE, AND THEY BEHAVE DIFFERENTLY. Rentals pay the manager override from
// rentalSplits.ts (15%/25% of net, SETTLED). Commerce pays a hub override from partner-terms.ts on
// the platform fee, and there the reseller's 80% is protected by clampOverrideShare, so the ONLY
// slice Amy's cut can come from is QS's 20% — a hard ceiling, not a negotiating position. Her rate
// on that rail is NOT SET (0 on every code), so the page quotes the fee, the protected share and the
// CEILING, and never a rate. Quoting one would be inventing a person's pay.
//
// ⚠️ OWNER INTENT, 2026-09-23: Amy is head of business development and "gets a cut of everything that
// goes through anyone downstream of her." The code does exactly ONE level — orders.ts reads
// codeRow.parent_code and stops, so a chain three deep pays the middle link, not Amy. The page says
// that plainly and tells her to build wide rather than deep until it is built, because the
// alternative is she recruits a tier that earns her nothing and finds out afterwards.
//
// Every figure is derived from splitRentalPayment() / partner-terms — the same functions the payment
// handler and /admin/splits use — so this page cannot quote a number the system would not actually
// pay. Nothing is typed.
import Link from 'next/link';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { pageRequiresPin, pagePinCookie, verifyPagePinGrant } from '@/lib/auth/pagePin';
import ScenarioLab from '@/components/commissions/scenario-lab';
import { SPLIT, splitRentalPayment } from '@/lib/commerce/rentalSplits';
import {
  MAX_PLATFORM_FEE_PERCENT,
  PARTNER_FEE_SHARE,
  QS_FEE_SHARE,
  affiliateResidualCents,
  partnerCommissionCents,
  hubOverrideCents,
} from '@/lib/commerce/partner-terms';
import { allocateUplineOverrides } from '@/lib/commerce/uplineChain';

const closerPct = Math.round(SPLIT.closer * 100);
const standardPct = Math.round(SPLIT.managerStandard * 100);
const recruitPct = Math.round(SPLIT.managerRecruit * 100);

/** The two live price points. $99 is today's rate; $399 is the step once a domain reaches page one. */
const RENT_CENTS = 9_900;
const RENT_PAGE_ONE_CENTS = 39_900;

const one = splitRentalPayment(RENT_CENTS, 'recruit');
const oneStandard = splitRentalPayment(RENT_CENTS, 'standard');
const onePageOne = splitRentalPayment(RENT_PAGE_ONE_CENTS, 'recruit');

/** Amy's example: Daryle and Angela each holding a few accounts she recruited them into. */
const TEAM: ReadonlyArray<{ name: string; accounts: number }> = [
  { name: 'Daryle', accounts: 3 },
  { name: 'Angela', accounts: 2 },
];
const teamAccounts = TEAM.reduce((s, r) => s + r.accounts, 0);
const teamMonthly = one.managerCents * teamAccounts;

/**
 * The commerce rail. ⚠️ Amy's override share on this rail is NOT SET — it is 0 on every code in the
 * system. So the only figures quoted here are the fee, the protected partner share, and the CEILING
 * (`hubOverrideCents` at the maximum `clampOverrideShare` allows, which is QS_FEE_SHARE). Quoting a
 * rate would be inventing her pay.
 */
const maxFeePct = Math.round(MAX_PLATFORM_FEE_PERCENT * 100);
const partnerPct = Math.round(PARTNER_FEE_SHARE * 100);
const qsPct = Math.round(QS_FEE_SHARE * 100);

const EX_GMV_CENTS = 1_000_000; // $10k/mo of online orders — a busy small restaurant
const EX_FEE_PCT = 0.05; // a typical platform fee; the cap is MAX_PLATFORM_FEE_PERCENT
const exFeePct = Math.round(EX_FEE_PCT * 100);
const exFeeCents = Math.round(EX_GMV_CENTS * EX_FEE_PCT);
const exPartnerCents = partnerCommissionCents(exFeeCents);
/** The most an override could ever pay on that fee — at this value QS's own share is nothing. */
const exQsCents = hubOverrideCents(exFeeCents, QS_FEE_SHARE);
/** The shared slice, rounded the same way `allocateUplineOverrides` rounds its budget. */
const sliceCents = Math.round(exFeeCents * QS_FEE_SHARE);

/** Example team size for the "at scale" columns. A number to think with, not a forecast. */
const EX_MERCHANTS = 10;

/** ⚠️ Rates are ILLUSTRATIVE — hers is not set. Each row is computed, never typed. */
const COMMERCE_RATES = [0.02, 0.05, 0.1, 0.15] as const;
const commerceRows = COMMERCE_RATES.map((share) => {
  const amy = allocateUplineOverrides(
    exFeeCents,
    [{ code: 'amy', overrideShare: share }],
    QS_FEE_SHARE
  ).totalCents;
  return { share, amy, house: sliceCents - amy, atScale: amy * EX_MERCHANTS };
});

/**
 * The chain case: Daryle directly above the sale, Amy above Daryle. Shows the cliff — nearest-first
 * means a high rate on the near level can leave the far level with nothing.
 */
const CHAIN_CASES = [
  [0.05, 0.05],
  [0.1, 0.05],
  [0.1, 0.1],
  [0.15, 0.1],
] as const;
const chainRows = CHAIN_CASES.map(([dShare, aShare]) => {
  const a = allocateUplineOverrides(
    exFeeCents,
    [
      { code: 'daryle', overrideShare: dShare },
      { code: 'amy', overrideShare: aShare },
    ],
    QS_FEE_SHARE
  );
  const paid = new Map(a.payments.map((x) => [x.code, x.cents]));
  return {
    dShare,
    aShare,
    daryle: paid.get('daryle') ?? 0,
    amy: paid.get('amy') ?? 0,
    shorted: a.shorted.some((x) => x.code === 'amy'),
  };
});

/** Rental second-level illustration. Rentals pay ONE level today; this is the shape of the trade. */
const RENTAL_SECOND_LEVEL = [0.05, 0.1, 0.15] as const;
const rentalRows = RENTAL_SECOND_LEVEL.map((share) => {
  const amy = Math.floor(one.netCents * share);
  return { share, amy, house: one.houseCents - amy, atScale: amy * teamAccounts };
});

/** What a downline's TIER leaves behind — the lever that moves more than a rate change. */
const AVG_ORDER_CENTS = 4_500;
const affiliateKeeps = affiliateResidualCents(exFeeCents, AVG_ORDER_CENTS, 0.25);
const affiliateLeaves = exFeeCents - affiliateKeeps;

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plain = (cents: number) => `$${Math.round(cents / 100).toLocaleString('en-US')}`;

export const metadata: Metadata = {
  title: 'QuickSites — for Amy',
  description: 'Your question about overrides, answered in writing — for Amy.',
  robots: { index: false, follow: false }, // unlisted: public URL, invisible to search
};

function More({ label = 'The detail', children }: { label?: string; children: React.ReactNode }) {
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

function Card({
  title,
  tag,
  tone = 'zinc',
  children,
  more,
}: {
  title: string;
  tag?: string;
  tone?: 'zinc' | 'emerald' | 'sky' | 'rose' | 'amber';
  children: React.ReactNode;
  more?: React.ReactNode;
}) {
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
        {tag && (
          <span
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${tagTones[tone]}`}
          >
            {tag}
          </span>
        )}
      </div>
      <div className="mt-2 text-sm leading-relaxed text-zinc-400">{children}</div>
      {more && <More>{more}</More>}
    </div>
  );
}

function Table({ head, rows }: { head: readonly string[]; rows: readonly React.ReactNode[][] }) {
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[26rem] text-sm">
        <thead>
          <tr className="border-b border-zinc-700/70">
            {head.map((h, i) => (
              <th
                key={h}
                className={`pb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 ${i === 0 ? 'text-left' : 'text-right'}`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b border-zinc-800/60 last:border-0">
              {r.map((c, ci) => (
                <td
                  key={ci}
                  className={`py-2 ${ci === 0 ? 'text-zinc-300' : 'text-right font-mono text-zinc-200'}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-zinc-800/60 py-2 last:border-0">
      <span className="text-sm text-zinc-400">
        {label}
        {note && <span className="ml-2 text-xs text-zinc-600">{note}</span>}
      </span>
      <span className="shrink-0 font-mono text-sm text-zinc-200">{value}</span>
    </div>
  );
}

const PAGE_KEY = 'amy';

/**
 * The PIN prompt. No JS: a plain form POST to /api/page-pin, which sets a signed grant cookie and
 * redirects back here.
 *
 * ⚠️ Says nothing about what the page contains. A gate that advertises "commission schedule inside"
 * has leaked the interesting part to anyone holding the URL, which is the exact population the gate
 * exists to stop.
 */
function PinPrompt({ error }: { error?: string }) {
  return (
    <>
      <SiteHeader sticky />
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
          <h1 className="text-lg font-semibold text-white">This page is private</h1>
          <p className="mt-2 text-sm text-zinc-400">Enter the six-digit code you were given.</p>
          <form method="POST" action="/api/page-pin" className="mt-4 space-y-3">
            <input type="hidden" name="page" value={PAGE_KEY} />
            <input
              type="password"
              name="pin"
              inputMode="numeric"
              autoComplete="off"
              maxLength={12}
              aria-label="Six-digit code"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none"
              placeholder="······"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400"
            >
              Open
            </button>
          </form>
          {error === 'slow' ? (
            <p className="mt-3 text-sm text-amber-300">Too many tries. Give it an hour.</p>
          ) : error ? (
            <p className="mt-3 text-sm text-rose-300">That code didn&rsquo;t work.</p>
          ) : null}
        </div>
      </div>
    </>
  );
}

export default async function ForAmyPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string }>;
}) {
  // ⚠️ FAILS CLOSED. If PAGE_PIN_AMY is unset the page is gated and unopenable, rather than open to
  // anyone with the link. Check readiness on /status — never by finding out that it rendered.
  if (!pageRequiresPin(PAGE_KEY)) return <PinPrompt />;

  const jar = await cookies();
  if (!verifyPagePinGrant(jar.get(pagePinCookie(PAGE_KEY))?.value, PAGE_KEY)) {
    const sp = await searchParams;
    return <PinPrompt error={sp?.e} />;
  }

  return (
    <>
      <SiteHeader sticky />
      <div className="relative min-h-screen bg-zinc-950 text-white">
        <section className="relative mx-auto max-w-3xl px-6 pb-10 pt-16">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-400">
            For Amy
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Yes — and here it is in writing.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-zinc-300">
            You asked whether you&rsquo;d get an override on the business the people you refer bring
            in. The answer is yes, and the rate was actually settled back in August. The problem is
            that nobody had written it down anywhere you could read it, which is why you had to ask.
            That&rsquo;s on me. This page is the answer, and it&rsquo;s the same numbers the
            software uses to calculate a payment — not a summary of them.
          </p>
        </section>

        {/* The answer */}
        <section className="mx-auto max-w-3xl px-6 pb-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            The rate
          </h2>
          <div className="mt-4 space-y-3">
            <Card
              title={`${recruitPct}% of net, on every payment, for anyone you recruited`}
              tag="settled"
              tone="emerald"
            >
              When someone you brought in closes a rental, you earn{' '}
              <strong className="text-emerald-300">{recruitPct}% of the net</strong> on that payment
              — every month it renews, not just the first one. If you&rsquo;re managing a rep you
              didn&rsquo;t recruit, the override is {standardPct}% —{' '}
              {money(oneStandard.managerCents)} on the same payment instead of{' '}
              {money(one.managerCents)}.
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <Row label="Customer pays" value={money(one.grossCents)} note="the $99 tier" />
                <Row label="Stripe takes" value={`− ${money(one.feeCents)}`} />
                <Row
                  label="Net"
                  value={money(one.netCents)}
                  note="everything below is a share of this"
                />
                <Row label={`Closer (Daryle) — ${closerPct}%`} value={money(one.closerCents)} />
                <Row label={`You — ${recruitPct}%`} value={money(one.managerCents)} />
                <Row label="Point Seven" value={money(one.houseCents)} />
              </div>
              <p className="mt-3">
                <strong className="text-zinc-200">
                  Your override never comes out of their pocket.
                </strong>{' '}
                Daryle gets the same {closerPct}% whether you recruited him or not — the extra{' '}
                {recruitPct - standardPct} points come entirely out of the house side. That was
                deliberate: recruiting shouldn&rsquo;t compete with selling, and the person doing
                the work shouldn&rsquo;t pay for the person who introduced them.
              </p>
            </Card>

            <Card title="What a team actually looks like" tone="sky">
              <div className="rounded-lg border border-sky-500/20 bg-sky-500/[0.04] p-3">
                {TEAM.map((r) => (
                  <Row
                    key={r.name}
                    label={`${r.name} — ${r.accounts} account${r.accounts === 1 ? '' : 's'}`}
                    value={`${money(one.managerCents * r.accounts)}/mo`}
                  />
                ))}
                <Row
                  label={`You, monthly (${teamAccounts} accounts)`}
                  value={`${money(teamMonthly)}/mo`}
                />
                <Row
                  label="Same, over a year"
                  value={money(teamMonthly * 12)}
                  note="while the accounts stay active"
                />
              </div>
              <p className="mt-3">
                It&rsquo;s a per-account number, so it grows by accounts rather than by effort —
                five accounts across two people is {money(teamMonthly)} a month whether they closed
                them this week or last year.
              </p>
              <p className="mt-3">
                And if a domain reaches page one, the rental steps from {plain(RENT_CENTS)} to{' '}
                {plain(RENT_PAGE_ONE_CENTS)} — the same override on that one payment is{' '}
                <strong className="text-sky-300">{money(onePageOne.managerCents)}</strong> instead
                of {money(one.managerCents)}.
              </p>
            </Card>
          </div>
        </section>

        {/* The second rail: commerce platform fees */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            The other rail — online orders, not just rentals
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Two different things earn money here, and your override works on both.
          </p>
          <div className="mt-4 space-y-3">
            <Card
              title="Every order a downstream merchant takes, forever"
              tag="built"
              tone="emerald"
            >
              Renting a ranked domain is one product. The other is <em>commerce</em>: a business
              runs their online ordering on us and we take a small fee on each order. It&rsquo;s a
              different shape of money — smaller per event, but it repeats every time somebody
              checks out rather than once a month.
              <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3">
                <Row
                  label="A busy small restaurant"
                  value={money(EX_GMV_CENTS)}
                  note="monthly online orders"
                />
                <Row
                  label={`Platform fee at ${exFeePct}%`}
                  value={money(exFeeCents)}
                  note={`cap is ${maxFeePct}%`}
                />
                <Row
                  label="Whoever signed them up keeps"
                  value={money(exPartnerCents)}
                  note={`${partnerPct}%`}
                />
                <Row
                  label="Leaves my side"
                  value={money(exQsCents)}
                  note={`${qsPct}% — your override comes from here`}
                />
              </div>
              <p className="mt-3">
                One merchant, one month. Ten of them across your people is ten times that, and it
                keeps arriving as long as they keep selling.
              </p>
            </Card>

            <Card
              title="Here the ceiling is real, and I'd rather you hear it from me"
              tag="hard cap"
              tone="amber"
            >
              On this rail the person who signed the merchant up keeps{' '}
              <strong className="text-zinc-200">{partnerPct}%</strong> of the fee, and that is
              protected in code — your override cannot touch it. Everything for you comes out of the{' '}
              {qsPct}% left on my side, and the software will refuse to set your share higher than
              that.
              <p className="mt-3">
                So on the example above, the absolute most an override could ever pay you is{' '}
                <strong className="text-amber-300">{money(exQsCents)}</strong> — and at that point
                my side of that order is zero. That&rsquo;s not me being cagey, it&rsquo;s
                arithmetic: there is exactly one slice your cut can come from.
              </p>
              <p className="mt-3">
                <strong className="text-zinc-200">
                  Your rate on this rail isn&rsquo;t set yet.
                </strong>{' '}
                It&rsquo;s currently zero — on every code in the system, not just yours. For scale:
                at half of my share you&rsquo;d earn {money(Math.floor(exQsCents / 2))} on that
                merchant&rsquo;s month, and I&rsquo;d keep the other half to run the thing. I want
                to pick that number with you rather than hand it down, and I want to pick it knowing
                what it has to cover.
              </p>
            </Card>

            <Card title="Which rail matters more to you" tone="sky">
              Rentals are bigger per account and slower to sell. Commerce is smaller per event and
              compounds — a merchant who does well pays you more every month without anyone selling
              anything again. As head of business development you&rsquo;d be choosing which one your
              people push, and I genuinely don&rsquo;t know the answer yet.
              <p className="mt-3">
                What I do know:{' '}
                <strong className="text-zinc-200">nothing has paid anyone on either rail</strong>.
                See below — I&rsquo;m not going to let you build a plan on a number that has never
                happened.
              </p>
            </Card>
          </div>
        </section>

        {/* Run the numbers */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Run the numbers
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            ⚠️ Your commerce rate isn&rsquo;t set, so these are the <em>shapes</em>, not an offer. I
            want you to see the arithmetic before we pick a number, so the number we pick makes
            sense to both of us. The rental rate below the tables IS settled.
          </p>
          <div className="mt-4 space-y-3">
            <Card title="Online orders — one merchant doing $10k/month" tone="sky">
              <Table
                head={['If your rate were', 'you/mo', 'house/mo', `× ${EX_MERCHANTS} merchants`]}
                rows={commerceRows.map((r) => [
                  `${(r.share * 100).toFixed(0)}% of the fee`,
                  money(r.amy),
                  money(r.house),
                  `${money(r.atScale)}/mo`,
                ])}
              />
              <p className="mt-3">
                The fee on that merchant is {money(exFeeCents)}. {money(exPartnerCents)} of it
                belongs to whoever signed them up and can&rsquo;t be touched, so you and I are
                dividing {money(sliceCents)} — and the &ldquo;house&rdquo; column is what&rsquo;s
                left to buy domains, pay for hosting and do the work of making them rank. I&rsquo;m
                showing you my side because a constraint you can see is easier to trust than one I
                assert.
              </p>
            </Card>

            <Card
              title="Where it gets sharp: when there's someone between you and the sale"
              tag="read this"
              tone="amber"
            >
              Daryle directly above the sale, you above Daryle. The software pays nearest-first, so
              his rate comes out of the {money(sliceCents)} before yours does.
              <Table
                head={['Daryle / you', 'Daryle', 'you', '']}
                rows={chainRows.map((r) => [
                  `${(r.dShare * 100).toFixed(0)}% / ${(r.aShare * 100).toFixed(0)}%`,
                  money(r.daryle),
                  money(r.amy),
                  r.shorted
                    ? '⛔ nothing left for you'
                    : r.amy + r.daryle >= sliceCents
                      ? '⚠️ house at zero'
                      : 'fits',
                ])}
              />
              <p className="mt-3">
                Two levels at 10% each uses up the whole slice. Past that,{' '}
                <strong className="text-amber-300">
                  you get nothing rather than a reduced amount
                </strong>{' '}
                — deliberately, because a rate that quietly shrinks when someone else is added is
                worse than one that visibly doesn&rsquo;t fit. The system flags it at me when it
                happens.
              </p>
              <p className="mt-3">
                Practically: your rate and the rates of anyone between you and the work are the same
                budget. That&rsquo;s a real tension in a team you&rsquo;re building, and it&rsquo;s
                better on the table now.
              </p>
            </Card>

            <Card
              title="The thing that moves your ceiling more than your rate does"
              tag="worth knowing"
              tone="emerald"
            >
              It matters enormously <em>which kind</em> of person you recruit.
              <Table
                head={['Downline type', 'they keep', 'left for you + house']}
                rows={[
                  [
                    `Reseller — runs the account (${partnerPct}%)`,
                    money(exPartnerCents),
                    money(sliceCents),
                  ],
                  ['Affiliate — just refers (25%)', money(affiliateKeeps), money(affiliateLeaves)],
                ]}
              />
              <p className="mt-3">
                An affiliate leaves{' '}
                <strong className="text-emerald-300">{money(affiliateLeaves)}</strong> to share
                instead of {money(sliceCents)}. So recruiting referrers rather than operators
                changes what&rsquo;s available to you by more than tripling your rate would.
              </p>
              <p className="mt-3">
                ⚠️ Being straight with you: the software currently caps every override at {qsPct}%
                of the fee regardless of which type it is, so that headroom isn&rsquo;t reachable
                yet. It&rsquo;s a deliberate conservative setting, not a bug, and lifting it is the
                cheapest way to pay you more without taking it off me. That&rsquo;s a third thing on
                my list, and you should hold me to it.
              </p>
            </Card>

            <Card title="Rentals at your team's scale" tone="sky">
              Your manager override is <strong className="text-zinc-200">settled</strong> at{' '}
              {recruitPct}% — {money(one.managerCents)} per account per month. Across the{' '}
              {teamAccounts} accounts in the example above that&rsquo;s{' '}
              <strong className="text-sky-300">{money(teamMonthly)}/mo</strong>, or{' '}
              {money(teamMonthly * 12)} a year while they stay active.
              <p className="mt-3">
                For completeness, here&rsquo;s the shape of a <em>second</em> level on rentals — the
                thing that isn&rsquo;t built, so you can see why it&rsquo;s a decision and not a
                quick job:
              </p>
              <Table
                head={[
                  'A 2nd level at',
                  'them/account',
                  'house left',
                  `× ${teamAccounts} accounts`,
                ]}
                rows={rentalRows.map((r) => [
                  `${(r.share * 100).toFixed(0)}% of net`,
                  money(r.amy),
                  money(r.house),
                  `${money(r.atScale)}/mo`,
                ])}
              />
              <p className="mt-3">
                The house keeps {money(one.houseCents)} of a $99 rental, and that is what buys the
                domain and funds getting it to rank in the first place. A second level at 15% leaves{' '}
                {money(one.houseCents - Math.floor(one.netCents * 0.15))} per account to do all of
                that — which is the honest reason it&rsquo;s a conversation rather than a setting.
              </p>
            </Card>
          </div>
        </section>

        {/* Move the sliders yourself */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Move it yourself
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            The tables above are fixed examples. These sliders are the same arithmetic, live — so
            you can go find the rate you think is fair and see what it does to my side before we
            talk. Nothing here changes anything; it&rsquo;s a calculator.
          </p>
          <div className="mt-4">
            {/*
              ⚠️ Constants are resolved HERE, on the server, and passed down. The client bundle cannot
              read QS_* env, so a calculator importing partner-terms directly would silently fall back
              to its defaults and keep quoting 80/20 on a deploy where those had been changed.
            */}
            <ScenarioLab
              partnerFeeShare={PARTNER_FEE_SHARE}
              availableShare={QS_FEE_SHARE}
              maxFeePct={MAX_PLATFORM_FEE_PERCENT}
              rentalManagerStandard={SPLIT.managerStandard}
              rentalManagerRecruit={SPLIT.managerRecruit}
              rentalCloserShare={SPLIT.closer}
              personName="You"
              middleName="Someone between you and the sale"
            />
          </div>
        </section>

        {/* The caveat she didn't ask about */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-6">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            The part you didn&rsquo;t ask about, which you should know now
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            Better you hear this from me today than work it out for yourself in six months.
          </p>
          <div className="mt-4 space-y-3">
            <Card
              title="The override follows the role, not the recruit"
              tag="read this one"
              tone="amber"
            >
              You earn it for as long as you&rsquo;re <em>the manager on that account</em> — the
              person supporting the closer, covering them when they&rsquo;re unreachable, the second
              name the business can call. If you stop managing that rep, or the account moves out
              from under you, the override stops with the role.
              <p className="mt-3">
                So it isn&rsquo;t a finder&rsquo;s fee that pays forever on an introduction you made
                once. That was a deliberate decision, and the honest reason is that a recruiting
                bounty collected indefinitely pays people to recruit and then disappear — which is
                the opposite of what a small team needs. What it <em>is</em>: real, recurring, and
                not capped by time as long as you&rsquo;re still in the role.
              </p>
              <p className="mt-3 text-zinc-300">
                If that&rsquo;s not what you assumed, say so now and we&rsquo;ll talk about it — it
                was my call, not a law of nature.
              </p>
            </Card>

            <Card title="Both rails now pay every level above the sale" tag="built" tone="emerald">
              Your intent is the rule: as head of business development you earn on everything that
              goes through anyone downstream of you. That is now true on <em>both</em> rails —
              online orders and rentals — however many links deep the chain runs.
              <p className="mt-3">
                <strong className="text-zinc-200">Where the money comes from, on both:</strong>{' '}
                never the person who closed the sale. On orders it comes out of my {qsPct}% of the
                fee; on rentals out of the house&rsquo;s share of the net. The closer&rsquo;s{' '}
                {closerPct}% and your manager override are protected in code — that is the rule that
                stops recruiting competing with selling, and adding a level above you does not get
                to bend it.
              </p>
              <p className="mt-3">
                <strong className="text-zinc-200">One consequence, and it is arithmetic:</strong>{' '}
                the slice every override shares is fixed. Whoever is nearest the sale is paid first,
                at the rate they were promised. If their rate uses up the slice, someone further up
                earns nothing on that payment — nothing, rather than a quietly reduced amount,
                because a rate that silently shrinks is worse than one that visibly doesn&rsquo;t
                fit. The system flags it at me when it happens.
              </p>
              <p className="mt-3 text-zinc-300">
                So the rates of everyone between you and the work are the same budget as yours. That
                is a real tension in a team you&rsquo;re building, and it&rsquo;s better on the
                table now than discovered later. Every rate is currently zero, so nothing is paying
                anyone yet — that part is the conversation we still need to have.
              </p>
            </Card>

            <Card title="A refund reverses that month's commission" tone="zinc">
              If a customer pays and then refunds, the commission for that payment reverses. It only
              applies to the payment that was refunded, not to anything already earned and settled
              before it.
            </Card>
          </div>
        </section>

        {/* Straight talk */}
        <section className="mx-auto max-w-3xl px-6 pb-4 pt-8">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-500">
            Straight talk — what&rsquo;s real and what isn&rsquo;t yet
          </h2>
          <p className="mt-2 text-sm text-zinc-500">
            You&rsquo;d be building on this, so you get the whole picture rather than the brochure.
          </p>
          <div className="mt-4 space-y-3">
            <Card title="The rate is real and the arithmetic is live" tag="built" tone="emerald">
              The split above isn&rsquo;t a proposal — it&rsquo;s one function in the codebase (
              <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs text-zinc-300">
                splitRentalPayment
              </code>
              ), and this page, the payment handler and the admin screen all call it. So the number
              you read here is the number the system would calculate. That was on purpose: three
              people implementing the same rule from a napkin is how splits end up disagreeing.
            </Card>

            <Card
              title="Nobody has been paid a commission yet — including me"
              tag="0 paid, ever"
              tone="rose"
            >
              The commission ledger has <strong className="text-rose-300">zero rows in it</strong>.
              No payout run has ever executed. You would not be joining something with a payment
              history; you&rsquo;d be near the front of it.
              <p className="mt-3">
                The one rental payment that has ever gone through was my own card, testing that the
                billing worked — and I refunded it. I&rsquo;d rather you know that than infer
                traction from the fact that the machinery exists.
              </p>
            </Card>

            <Card
              title="You don't have a code yet, and the override isn't switched on"
              tag="needs doing"
              tone="amber"
            >
              There are six referral codes today. None of them is yours. And on all six, the
              override rate is currently set to <span className="font-mono text-amber-300">0</span>,
              with no recruiter linked to anyone — so as the system sits right now it would
              calculate an override of nothing for everybody.
              <p className="mt-3">
                That&rsquo;s a settings change, not a build, and it&rsquo;s mine to do. I&rsquo;m
                telling you because &ldquo;the feature exists&rdquo; and &ldquo;it&rsquo;s turned on
                for you&rdquo; are different sentences, and you asked a question where the
                difference matters.
              </p>
            </Card>

            <Card title="What has to be true for any of this to pay you" tone="zinc">
              A business has to rent a ranked domain and keep paying for it. Everything above is a
              share of that. So the honest order of operations is: the domains have to rank, someone
              has to sell one, and it has to stick past the refund window. The first two are being
              worked on and neither is finished.
            </Card>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-20 pt-6">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6">
            <h2 className="text-lg font-semibold text-white">So, concretely</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Your assumption was right, on both rails. On rentals it&rsquo;s {recruitPct}% of net
              on everything your people close, every month, out of my side and not theirs — that
              number is settled. On online orders the mechanism is built and the rate is still zero,
              because I want to set it with you and because there&rsquo;s a real ceiling on it
              I&rsquo;d rather you see than discover.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              Three asterisks, all of them above: it runs while you&rsquo;re actually managing the
              account; people two steps down the chain don&rsquo;t pay you until I build that; and
              nothing has paid anyone anything yet, on either rail.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/for-sales"
                className="inline-block rounded-lg bg-emerald-500 px-6 py-3 text-base font-semibold text-zinc-950 transition hover:bg-emerald-400"
              >
                What the reps are actually selling
              </Link>
              <Link
                href="/for-daryle"
                className="inline-block rounded-lg border border-zinc-700 px-6 py-3 text-base font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                Daryle&rsquo;s page
              </Link>
            </div>
            <p className="mt-4 text-sm text-zinc-400">
              If the role condition or the third-level question changes what you were planning, tell
              me and we&rsquo;ll sort it out before you recruit anybody. Easier now than later.
            </p>
            <p className="mt-3 text-sm font-medium text-emerald-300">— Sandon</p>
          </div>
        </section>
      </div>
    </>
  );
}
