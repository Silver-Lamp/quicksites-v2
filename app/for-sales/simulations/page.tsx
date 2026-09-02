// app/for-sales/simulations/page.tsx
//
// What the rehearsal engine actually did, on a fixed script, on a real day.
//
// ⚠️ THIS PAGE REPORTS, IT DOES NOT GRADE. `expected` is what we predicted before the call; the
// engine is not obliged to agree with us. A row where they differ is a thing to read, and the
// transcript beside it is how you work out whether the engine missed something or our expectation
// was wrong. Anything that renders this as a pass/fail score is claiming our guesses are ground
// truth — which is exactly the dishonesty the lane exists to prevent, pointed inward.
//
// Unlisted like the rest of /for-sales: public URL, noindex, linked from nowhere.
import type { Metadata } from 'next';
import Link from 'next/link';
import { loadLatestRun, RULE_LABEL, SCENARIOS } from '@/lib/rehearsal/simulations';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export const metadata: Metadata = {
  title: 'Rehearsal simulations — QuickSites',
  description: 'What the practice engine did on a fixed script.',
  robots: { index: false, follow: false },
};

function Pill({ tone, children }: { tone: 'ok' | 'warn' | 'muted'; children: React.ReactNode }) {
  const cls =
    tone === 'ok'
      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
      : tone === 'warn'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
        : 'border-zinc-700 bg-zinc-900 text-zinc-400';
  return (
    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

export default async function SimulationsPage() {
  const rows = await loadLatestRun();

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <header>
          <h1 className="text-2xl font-bold tracking-tight">Rehearsal simulations</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            A fixed script of {SCENARIOS.length} calls, run against the live engine and recorded.
            Three lines break one of the lane&apos;s honesty rules; two break none — and the
            quiet ones matter more, because a coach that flags a correct answer teaches a rep to
            ignore it.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500">
            &ldquo;Expected&rdquo; is what we predicted before the call, not ground truth. Where
            the engine differs, read the transcript rather than the label — one of the two is
            wrong and only the words tell you which.{' '}
            <Link href="/for-sales/call" className="text-amber-400 underline underline-offset-4">
              the call sheet
            </Link>{' '}
            ·{' '}
            <Link href="/for-sales/practice" className="text-amber-400 underline underline-offset-4">
              practice live
            </Link>
          </p>
        </header>

        {rows.length === 0 ? (
          <p className="mt-8 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
            No run recorded yet. An operator runs the set with{' '}
            <code className="rounded bg-zinc-800 px-1 py-0.5 text-xs">
              POST /api/admin/rehearsal/simulate
            </code>
            .
          </p>
        ) : (
          <div className="mt-8 space-y-5">
            {rows.map((r) => {
              const flags = (r.honesty_flags as any[]) || [];
              const ruleIds = flags.map((f) => f?.rule_id).filter(Boolean);
              const expected = r.expected_rule_id;
              const agreed = expected ? ruleIds.includes(expected) : ruleIds.length === 0;

              return (
                <article
                  key={r.scenario_key}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="text-base font-semibold text-white">{r.scenario_label}</h2>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.status === 'error' ? (
                        <Pill tone="warn">error</Pill>
                      ) : agreed ? (
                        <Pill tone="ok">as expected</Pill>
                      ) : (
                        <Pill tone="warn">differs — read it</Pill>
                      )}
                      <Pill tone="muted">
                        {expected ? `expected ${expected}` : 'expected no flag'}
                      </Pill>
                    </div>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-zinc-500">{r.tests}</p>

                  {r.transcript?.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {r.transcript.map((t: any, i: number) => (
                        <p key={i} className="text-xs leading-relaxed text-zinc-500">
                          <span className="mr-1.5 uppercase tracking-wide">
                            {t.who === 'rep' ? 'you' : 'them'}
                          </span>
                          {t.text}
                        </p>
                      ))}
                    </div>
                  )}

                  <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.05] p-3 text-sm leading-relaxed text-zinc-200">
                    <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-amber-400">
                      You
                    </span>
                    {r.rep_said}
                  </p>

                  {r.status === 'error' ? (
                    <p className="mt-3 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
                      {r.error}
                    </p>
                  ) : (
                    <>
                      {r.prospect_line && (
                        <p className="mt-2 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm leading-relaxed text-zinc-300">
                          <span className="mr-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                            Them
                          </span>
                          {r.prospect_line}
                        </p>
                      )}

                      <div className="mt-3 space-y-2">
                        {flags.length === 0 ? (
                          <p className="text-sm text-zinc-500">No honesty flag raised.</p>
                        ) : (
                          flags.map((f: any, i: number) => (
                            <div
                              key={i}
                              className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] p-3"
                            >
                              <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300">
                                {String(f?.rule_id || '').replace(/_/g, ' ')}
                              </div>
                              <p className="mt-1 text-xs leading-relaxed text-zinc-500">
                                {RULE_LABEL[f?.rule_id] || ''}
                              </p>
                              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                                &ldquo;{f?.quote}&rdquo;
                              </p>
                              {/* The distinction HJ's guard cannot make: a quote can be real and
                                  still isolate nothing. */}
                              <p className="mt-1 text-[11px] text-zinc-500">
                                {r.isolating?.[i]
                                  ? 'quote points at part of the line'
                                  : '⚠️ quoted the whole line back — real, but it does not say where'}
                              </p>
                            </div>
                          ))
                        )}
                      </div>

                      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-zinc-500">
                        <span>
                          matched objection:{' '}
                          <span className="text-zinc-300">{r.objection_id || 'none'}</span>
                        </span>
                        <span>
                          dropped:{' '}
                          <span className="text-zinc-300">{r.flags_dropped ?? '—'}</span>
                        </span>
                        <span>
                          still listening:{' '}
                          <span className="text-zinc-300">{r.would_keep_listening || '—'}</span>
                        </span>
                        <span>
                          cost:{' '}
                          <span className="text-zinc-300">
                            {r.cost_cents === null ? 'unknown' : `${r.cost_cents}c`}
                          </span>
                        </span>
                        <span>
                          <span className="text-zinc-300">{r.latency_ms ?? '—'}ms</span>
                        </span>
                      </dl>
                    </>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
