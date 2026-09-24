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
// Every figure is derived from splitRentalPayment() — the same function the API and /admin/splits
// use — so this page cannot quote a number the system would not actually pay. Nothing is typed.
import Link from 'next/link';
import type { Metadata } from 'next';
import SiteHeader from '@/components/site/site-header';
import { SPLIT, splitRentalPayment } from '@/lib/commerce/rentalSplits';

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

export default function ForAmyPage() {
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

            <Card
              title="Your second example isn't decided yet"
              tag="open — my call to make"
              tone="rose"
            >
              You wrote &ldquo;anyone Daryle brings in.&rdquo; If you mean the <em>businesses</em>{' '}
              Daryle signs up, that&rsquo;s the {recruitPct}% above and it&rsquo;s settled. But if
              you mean someone <em>Daryle recruits</em> as a rep — a third level under you — there
              is no rule for that, because the model has exactly one manager slot per account and
              nobody has ever needed a second.
              <p className="mt-3">
                I&rsquo;d rather tell you it&rsquo;s undecided than invent a number to sound
                organised. If you&rsquo;re planning to build a team that deep, that&rsquo;s a real
                conversation and it changes the maths, so let&rsquo;s have it before you start
                making promises to people on my behalf.
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
              Your assumption was right: {recruitPct}% of net on everything your people close, every
              month, out of my side and not theirs. Two asterisks — it runs while you&rsquo;re
              actually managing the account, and a third level under Daryle isn&rsquo;t a thing yet.
              Nothing has paid anyone anything so far.
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
