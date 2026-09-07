// app/for-sales/rate-card/page.tsx
// The live rate card: which domains a rep may pitch as "on page one today", the phrase that proves
// it, and what to charge. Admin-gated — it carries pricing and unpitchable-domain flags.
//
// ⚠️ EVERY FIGURE IS READ AT RENDER FROM `gsc_cache`, and the window is printed at the top. The
// static twin of this page (/proof/rankings) is a deliberately DATED snapshot for prospects; this
// one is the working copy, because a rep quoting a position from a frozen file is quoting the past.
// Rankings move — that is why Refresh exists and why the date is not decoration.
import type { Metadata } from 'next';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { loadRateCard } from '@/lib/sales/rateCardData';
import { valuePortfolio } from '@/lib/sales/portfolioValuation';
import { formatCents } from '@/lib/outreach/geoPricing';
import RefreshButton from './refresh-button';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Rate card — QuickSites',
  robots: { index: false, follow: false },
};

export default async function RateCardPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-zinc-400">Forbidden.</div>;

  const { rows, window, measuredAt, unreadable, rentedCount } = await loadRateCard();
  const proven = rows.filter((r) => r.qualifies);
  // ⚠️ A CAPACITY figure, not a forecast. `rentedToday` is rendered beside every total below for
  // exactly one reason: while it is zero, each of these numbers is a sentence about inventory and
  // none of them is a sentence about money.
  const val = valuePortfolio(rows, { rentedToday: rentedCount });
  const pitchable = proven.filter((r) => r.pitchable);
  const founder = rows.filter((r) => !r.qualifies);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-300">
      <div className="mx-auto max-w-5xl px-6 py-10">

        <header className="border-b-2 border-zinc-700 pb-5">
          <div className="font-mono text-[11px] uppercase tracking-[0.16em] text-emerald-400">
            Geo domain rental · internal
          </div>
          <h1 className="mt-1 text-3xl font-bold uppercase tracking-tight text-white">Page-one rate card</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            The domains holding page one <strong className="text-zinc-200">today</strong> for the phrase their
            customers type — the only ones a rep may present as ranking.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs text-zinc-500">
            <span>
              Window:{' '}
              <span className="text-zinc-300">
                {window ? `${window.start} → ${window.end}` : 'no Search Console data cached'}
              </span>
            </span>
            <span>Pulled: <span className="text-zinc-300">{measuredAt ? measuredAt.slice(0, 10) : '—'}</span></span>
            <span className="text-amber-400">Re-check before every pitch.</span>
          </div>
          <div className="mt-4"><RefreshButton /></div>
        </header>

        <section className="mt-8 grid grid-cols-3 gap-3">
          <Stat n={String(pitchable.length)} label="pitchable now" tone="emerald" />
          <Stat n={String(proven.length - pitchable.length)} label="rank, but blocked" tone="amber" />
          <Stat n={String(founder.length)} label="founder tier" tone="zinc" />
        </section>

        <Section title="Proven — page one today" hint="strongest proof first, by appearances">
          {proven.length === 0 && (
            <p className="text-sm text-zinc-500">
              No domain currently holds page one for its own city+trade phrase. That is a real
              answer, not an empty state — pitch the founder tier and say so plainly.
            </p>
          )}
          <div className="flex flex-col gap-2">
            {proven.map((r) => (
              <article
                key={r.host}
                className={`rounded border bg-zinc-900/60 p-4 ${
                  r.pitchable ? 'border-zinc-800' : 'border-l-4 border-l-zinc-600 border-zinc-800 opacity-80'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-[13rem]">
                    <div className="font-mono text-base font-semibold text-white">{r.host}</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {r.city && r.state ? `${r.city}, ${r.state}` : 'service area not set'}
                      {r.phone ? ` · ${r.phone}` : ' · no phone'}
                    </div>
                  </div>

                  <div className="min-w-[15rem] flex-1">
                    <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-400">
                      Have them search
                    </div>
                    <div className="mt-1 inline-block rounded bg-emerald-500/10 px-2 py-1 font-mono text-sm text-emerald-200">
                      {r.proofQuery}
                    </div>
                    <div className="mt-2 flex gap-6 font-mono text-sm tabular-nums text-zinc-300">
                      <span>
                        {r.proofPosition}
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-zinc-600">position</span>
                      </span>
                      <span>
                        {r.proofAppearances}
                        <span className="ml-1 text-[10px] uppercase tracking-wider text-zinc-600">appearances</span>
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono text-xl font-bold text-white tabular-nums">
                      {formatCents(r.fullCents)}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-zinc-600">page-one rate / mo</div>
                  </div>
                </div>

                {r.blockers.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1 border-t border-zinc-800 pt-2">
                    {r.blockers.map((b) => (
                      <li
                        key={b.id}
                        className={`font-mono text-[11px] ${b.severity === 'stop' ? 'text-red-400' : 'text-amber-400'}`}
                      >
                        {b.severity === 'stop' ? 'DO NOT PITCH — ' : 'WARN — '}
                        {b.label}
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>
        </Section>

        <Section title="Portfolio valuation" hint="what the provable inventory would bill if every domain rented">
          <div className="rounded border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums text-white">
                  {formatCents(val.grossAtListCents)}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  per month at the page-one rate
                </div>
                <div className="mt-1 font-mono text-xs text-zinc-500">
                  {formatCents(val.annualAtListCents)} / year
                </div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums text-zinc-300">
                  {formatCents(val.grossAtFounderCents)}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  per month at the founder rate
                </div>
                <div className="mt-1 font-mono text-xs text-zinc-500">locked for life once signed</div>
              </div>
              <div>
                <div className="font-mono text-2xl font-bold tabular-nums text-zinc-300">
                  {formatCents(val.houseAtListCents)}
                </div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">
                  reaches the house, at list
                </div>
                <div className="mt-1 font-mono text-xs text-zinc-500">
                  after card fees and both commissions
                </div>
              </div>
            </div>

            <p className="mt-4 border-t border-zinc-800 pt-3 text-sm leading-relaxed text-amber-400">
              Rented today: <span className="font-mono font-bold">{val.rentedToday}</span> of{' '}
              <span className="font-mono">{val.provenCount}</span>. Every figure above is what this
              inventory <em>could</em> bill, not what anyone has agreed to pay — nobody outside the
              company has rented one of these. It is a ceiling, and it is the number most likely to
              be misread as revenue.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-zinc-500">
              {val.provenCount - val.pitchableCount > 0 && (
                <>
                  {val.provenCount - val.pitchableCount} of the {val.provenCount} cannot be pitched
                  today — see the stop flags above; they are inventory, not sales.{' '}
                </>
              )}
              The house share is the remainder after the closer and manager, taken from net of card
              fees, split per rental — Stripe&apos;s fixed fee lands once per domain, not once per
              portfolio.
            </p>
          </div>
        </Section>

        <Section title="Founder tier" hint="not ranking yet — the discount is for the risk they carry">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-left text-sm">
              <thead className="border-b border-zinc-800 font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                <tr>
                  <th className="pb-2">domain</th>
                  <th className="pb-2">where</th>
                  <th className="pb-2 text-right tabular-nums">site avg</th>
                  <th className="pb-2 text-right">founder / mo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {founder.map((r) => (
                  <tr key={r.host}>
                    <td className="py-1.5 font-mono text-zinc-300">{r.host}</td>
                    <td className="py-1.5 text-xs text-zinc-500">
                      {r.city && r.state ? `${r.city}, ${r.state}` : '—'}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-zinc-400">
                      {r.siteAveragePosition ?? '—'}
                    </td>
                    <td className="py-1.5 text-right font-mono tabular-nums text-zinc-300">
                      {formatCents(r.lockedCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 max-w-2xl text-xs leading-relaxed text-zinc-500">
            The lock is the close, not a promise: whoever rents at the founder rate keeps paying it
            after the domain reaches page one. That makes a ranking a benefit they own rather than a
            result you owe.
          </p>
        </Section>

        <Section title="What you say" hint="tense is the whole difference">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded border border-emerald-800 bg-emerald-950/30 p-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-emerald-400">Approved</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-zinc-300">
                <li>&ldquo;Search <em className="font-mono not-italic text-emerald-200">{pitchable[0]?.proofQuery ?? 'the phrase above'}</em> right now — go ahead, I&apos;ll wait.&rdquo;</li>
                <li>&ldquo;That&apos;s us on page one today. I&apos;ll send the screenshot with the date on it.&rdquo;</li>
                <li>&ldquo;That domain goes to exactly one business in town. Right now that could be you.&rdquo;</li>
                <li>&ldquo;Your rate locks at signup and never moves.&rdquo;</li>
              </ul>
            </div>
            <div className="rounded border border-red-900 bg-red-950/20 p-4">
              <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-red-400">Never say</h3>
              <ul className="mt-3 flex flex-col gap-2 text-sm leading-relaxed text-zinc-300">
                <li>&ldquo;Get seen on page one when someone googles towing in your city.&rdquo;</li>
                <li>&ldquo;This&apos;ll get you on page one.&rdquo;</li>
                <li>&ldquo;You&apos;ll rank for towing in Covington.&rdquo;</li>
                <li>&ldquo;You&apos;ll get X calls a month.&rdquo; — or any number of calls, leads or jobs.</li>
              </ul>
              <p className="mt-3 border-t border-red-900 pt-2 text-xs leading-relaxed text-zinc-400">
                Each is a <strong>future</strong> claim about a result you do not control; the first three are
                logged verbatim as banned phrases in the rehearsal lane&apos;s{' '}
                <code className="rounded bg-zinc-800 px-1 font-mono">no_ranking_promise</code> rule. The fix is
                always the same — change the tense, and point at something they can check.
              </p>
            </div>
          </div>
        </Section>

        {unreadable.length > 0 && (
          <Section title="Unreadable properties" hint="surfaced, not silently dropped">
            <ul className="flex flex-col gap-1 font-mono text-xs text-amber-400">
              {unreadable.map((u) => (
                <li key={u.host}>{u.host} — {u.error}</li>
              ))}
            </ul>
          </Section>
        )}

        <p className="mt-10 border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-600">
          Appearances = times our result was shown for that exact phrase in the window. A domain
          qualifies only on a <strong>city + trade</strong> query it holds on page one — never on
          &ldquo;near me&rdquo; style searches, which sit at one or two appearances a month with no
          clicks. Prospect-facing twin: <span className="font-mono">/proof/rankings</span>.
        </p>
      </div>
    </div>
  );
}

function Stat({ n, label, tone }: { n: string; label: string; tone: 'emerald' | 'amber' | 'zinc' }) {
  const color = tone === 'emerald' ? 'text-emerald-400' : tone === 'amber' ? 'text-amber-400' : 'text-zinc-300';
  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
      <div className={`font-mono text-2xl font-bold tabular-nums ${color}`}>{n}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-200">{title}</h2>
        {hint && <span className="text-xs text-zinc-600">{hint}</span>}
        <div className="h-px flex-1 bg-zinc-800" />
      </div>
      {children}
    </section>
  );
}
