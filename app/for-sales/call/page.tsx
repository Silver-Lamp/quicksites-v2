// app/for-sales/call/page.tsx
//
// The live-call reference: the one page a rep keeps open (or printed) WHILE the phone is
// ringing. Companion to /for-sales, which is the brief you read beforehand.
//
// ⚠️ THREE CONSTRAINTS, ALL OF THEM ABOUT THE MOMENT IT IS USED, NOT ABOUT TASTE.
//
// 1. It must work with NO NETWORK AND NO MODEL. A rep is mid-sentence with a business owner;
//    nobody waits on an inference, and a call taken truck-side may have no signal at all. So:
//    server-rendered from static data, zero client JS, no fetch, nothing lazy. Pinned by
//    lib/sales/__tests__/lanes.test.ts.
// 2. It must be SCANNABLE, not readable. Everything is visible at once — no accordions. The
//    brief at /for-sales folds its detail away precisely so this page does not have to.
// 3. It must PRINT. A dark page prints as a black rectangle or as white-on-white, so the print
//    stylesheet flips the whole thing to ink on paper and keeps cards off page breaks.
//
// The objections come from lib/sales/lanes/geoDomainRental.ts — the same lane spec that feeds
// HiveJournal's practice engine (crosstalk/contracts/rehearsal-engine.md), so the branch a rep
// rehearsed is the branch they see here, by id.
import Link from 'next/link';
import type { Metadata } from 'next';
import { GEO_DOMAIN_RENTAL_LANE as LANE } from '@/lib/sales/lanes/geoDomainRental';

export const metadata: Metadata = {
  title: 'Call sheet — QuickSites',
  description: 'The live reference for a domain-rental call: the spine, the objections, the line you never cross.',
  robots: { index: false, follow: false }, // unlisted, like /for-sales
};

const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  .callsheet { background: #fff !important; color: #111 !important; }
  .callsheet * { color: #111 !important; border-color: #bbb !important; box-shadow: none !important; }
  .callsheet .surface { background: #fff !important; }
  .callsheet .rule-band { background: #fff !important; border: 2px solid #111 !important; position: static !important; }
  .callsheet .card { break-inside: avoid; page-break-inside: avoid; }
  .callsheet .no-print { display: none !important; }
  .callsheet a[href]:after { content: ""; }
}
`;

function Step({ n, label, goal, say }: { n: number; label: string; goal: string; say?: string }) {
  return (
    <li className="card surface relative rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-mono text-xs font-semibold text-amber-400">{n}</span>
        <h3 className="text-sm font-semibold text-white">{label}</h3>
      </div>
      <p className="mt-1 text-xs leading-relaxed text-zinc-400">{goal}</p>
      {say && (
        <p className="mt-2 border-l-2 border-amber-500/40 pl-3 text-sm leading-relaxed text-zinc-200">
          &ldquo;{say}&rdquo;
        </p>
      )}
    </li>
  );
}

export default function CallSheetPage() {
  const hardRule = LANE.honestyRules[0];

  return (
    <div className="callsheet min-h-screen bg-zinc-950 text-white">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      {/* The one rule, pinned. It is the thing a rep breaks under pressure, so it does not
          scroll away — and on paper it is the first thing on the page. */}
      <div className="rule-band sticky top-0 z-20 border-b border-rose-500/40 bg-rose-950/80 px-5 py-3 backdrop-blur">
        <p className="mx-auto max-w-5xl text-sm font-semibold leading-snug text-rose-100">
          ⚠️ {hardRule.rule}{' '}
          <span className="font-normal text-rose-200/80">
            Not &ldquo;{hardRule.violatingExamples[0]},&rdquo; not &ldquo;
            {hardRule.violatingExamples[1]}.&rdquo; You don&apos;t know.
          </span>
        </p>
      </div>

      <div className="mx-auto max-w-5xl px-5 py-8">
        <header className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Call sheet</h1>
            <p className="mt-1 text-sm text-zinc-400">{LANE.sells}</p>
          </div>
          <p className="no-print text-xs text-zinc-500">
            <Link href="/for-sales" className="text-amber-400 underline underline-offset-4">
              ← the brief
            </Link>{' '}
            · print this and keep it beside the phone
          </p>
        </header>

        <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.06] p-3 text-sm leading-relaxed text-zinc-300">
          <span className="font-semibold text-emerald-300">Win condition:</span> {LANE.goal}
        </p>

        {/* ── The spine ─────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            The call, in order
          </h2>
          <ol className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LANE.steps.map((s, i) => (
              <Step key={s.id} n={i + 1} label={s.label} goal={s.goal} say={s.say} />
            ))}
          </ol>
        </section>

        {/* ── Objections ────────────────────────────────────── */}
        <section className="mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            When they push back
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Answer the one they raised, then go back to asking. Stacking answers reads as
            nerves.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {LANE.objections.map((o) => (
              <div
                key={o.id}
                className="card surface rounded-lg border border-zinc-800 bg-zinc-900/40 p-4"
              >
                <h3 className="text-sm font-semibold text-white">&ldquo;{o.says}&rdquo;</h3>
                <p className="mt-2 flex gap-2 text-sm leading-relaxed text-zinc-300">
                  <span aria-hidden className="shrink-0 text-emerald-400">
                    ✓
                  </span>
                  {o.goodMove}
                </p>
                <p className="mt-1.5 flex gap-2 text-sm leading-relaxed text-zinc-500">
                  <span aria-hidden className="shrink-0 text-rose-400">
                    ✕
                  </span>
                  {o.trap}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── The two lists that keep the call honest ───────── */}
        <section className="mt-8 grid gap-3 md:grid-cols-2">
          <div className="card surface rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
              True — say these freely
            </h2>
            <ul className="mt-2 space-y-2">
              {LANE.trueClaims.map((c) => (
                <li key={c} className="text-sm leading-relaxed text-zinc-300">
                  <span aria-hidden className="mr-2 text-emerald-500">
                    ✓
                  </span>
                  {c}
                </li>
              ))}
            </ul>
          </div>

          <div className="card surface rounded-lg border border-rose-500/30 bg-rose-500/[0.05] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-rose-300">
              Never — including in your own words
            </h2>
            <ul className="mt-2 space-y-3">
              {LANE.honestyRules.map((r) => (
                <li key={r.id} className="text-sm leading-relaxed text-zinc-300">
                  <span aria-hidden className="mr-2 text-rose-400">
                    ✕
                  </span>
                  {r.rule}
                  <span className="mt-1 block pl-6 text-xs italic text-zinc-500">
                    {r.violatingExamples.map((e) => `“${e}”`).join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <p className="mt-8 border-t border-zinc-800 pt-4 text-xs leading-relaxed text-zinc-500">
          This page holds no live data and makes no network call once it has loaded — it is meant
          to survive a truck-side call with one bar of signal, or a printer. Everything on it
          comes from{' '}
          <code className="rounded bg-zinc-800 px-1 py-0.5">lib/sales/lanes/geoDomainRental.ts</code>
          , which is also what the practice engine reads, so what you rehearse and what you see
          here cannot drift apart.
        </p>
      </div>
    </div>
  );
}
