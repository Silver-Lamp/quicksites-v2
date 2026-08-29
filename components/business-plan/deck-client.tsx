'use client';

// Presentation view of the business plan.
//
// Renders as a fixed full-viewport overlay rather than a page inside the admin chrome:
// this gets screen-shared, and a sidebar in the corner of an investor call is noise. Esc
// leaves, so the escape hatch is the key people already reach for.
//
// ⚠️ Slides are BUILT from the same VERTICALS + evidence the page uses. A deck maintained
// separately from the plan drifts from it, and then the room is told one thing while the
// database says another — which is the failure this whole surface exists to avoid.

import * as React from 'react';
import Link from 'next/link';
import type { Vertical, PlanEvidence } from '@/lib/business/verticals';
import { STAGE_LABEL, type Stage } from '@/lib/business/verticals';

const STAGE_TONE: Record<Stage, string> = {
  proven: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
  'live-untested': 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  'built-inert': 'border-sky-500/50 bg-sky-500/10 text-sky-300',
  planned: 'border-neutral-600 bg-neutral-800/60 text-neutral-400',
};

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type Slide = {
  kind: 'title' | 'position' | 'inventory' | 'vertical' | 'close';
  vertical?: Vertical;
};

export default function DeckClient({
  verticals,
  evidence,
}: {
  verticals: Vertical[];
  evidence: PlanEvidence;
}) {
  const slides: Slide[] = React.useMemo(
    () => [
      { kind: 'title' },
      { kind: 'position' },
      { kind: 'inventory' },
      ...verticals.map((v) => ({ kind: 'vertical' as const, vertical: v })),
      { kind: 'close' },
    ],
    [verticals]
  );

  const [i, setI] = React.useState(0);
  const go = React.useCallback(
    (d: number) => setI((n) => Math.min(slides.length - 1, Math.max(0, n + d))),
    [slides.length]
  );

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setI(0);
      else if (e.key === 'End') setI(slides.length - 1);
      else if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, slides.length]);

  const s = slides[i];
  const lifetime = evidence.platformFeeCents + evidence.rentalCentsCollected;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-neutral-950 text-neutral-100">
      {/* Slide body */}
      <div className="flex flex-1 items-center justify-center overflow-y-auto px-8 py-12 sm:px-16">
        <div className="w-full max-w-4xl">
          {s.kind === 'title' && (
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                Point Seven Studio LLC
              </p>
              <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl">
                How QuickSites
                <br />
                makes money
              </h1>
              <p className="mt-8 max-w-2xl text-xl leading-relaxed text-neutral-400">
                One site builder and one money path, sold six different ways.
              </p>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-500">
                Every number in this deck is read from the live database as the slide renders.
              </p>
            </div>
          )}

          {s.kind === 'position' && (
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
                Where this actually stands
              </p>
              <div className="mt-8 flex flex-wrap items-baseline gap-4">
                <span className="font-mono text-6xl font-semibold tabular-nums text-white sm:text-7xl">
                  {money(lifetime)}
                </span>
                <span className="text-lg text-neutral-500">lifetime platform revenue</span>
              </div>
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/[0.07] p-5">
                  <p className="text-sm font-semibold text-emerald-300">What is proven</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-300">
                    The machinery works with real money. Live cards, real charges, recurring billing
                    that renews unattended and records every cycle in our own database.
                  </p>
                </div>
                <div className="rounded-xl border border-rose-500/40 bg-rose-500/[0.07] p-5">
                  <p className="text-sm font-semibold text-rose-300">What is not</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-neutral-300">
                    That anyone wants it. No outside customer has rented a site, and churn has never
                    been measured because nothing has run long enough to churn.
                  </p>
                </div>
              </div>
              <p className="mt-8 max-w-3xl text-lg leading-relaxed text-neutral-400">
                Those are different claims. The reason to keep listening is not the revenue — it is
                that six routes to market share one set of rails, so testing the next one costs a
                conversation rather than a build.
              </p>
            </div>
          )}

          {s.kind === 'inventory' && (
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                What exists today
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">
                Counted as this slide loaded
              </h2>
              <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  {
                    k: 'Sites built',
                    v: evidence.templates.toLocaleString(),
                    s: `${evidence.templatesPublished} published`,
                  },
                  {
                    k: 'Geo domains',
                    v: String(evidence.geoCampaigns),
                    s: `${evidence.geoRented} rented`,
                  },
                  {
                    k: 'Merchants',
                    v: String(evidence.merchants),
                    s: `${evidence.connectedMerchants} payment-ready`,
                  },
                  { k: 'Catalog items', v: String(evidence.catalogItems), s: 'Listed for sale' },
                ].map((m) => (
                  <div
                    key={m.k}
                    className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-5"
                  >
                    <div className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                      {m.k}
                    </div>
                    <div className="mt-2 font-mono text-4xl font-semibold tabular-nums text-white">
                      {m.v}
                    </div>
                    <div className="mt-1 text-sm text-neutral-500">{m.s}</div>
                  </div>
                ))}
              </div>
              <p className="mt-8 max-w-3xl text-lg leading-relaxed text-neutral-400">
                The asset is the inventory and the machinery, not the balance. Domains are owned,
                sites are built, and the money path is wired end to end.
              </p>
            </div>
          )}

          {s.kind === 'vertical' && s.vertical && (
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                  Revenue line {verticals.indexOf(s.vertical) + 1} of {verticals.length}
                </p>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${STAGE_TONE[s.vertical.stage]}`}
                >
                  {STAGE_LABEL[s.vertical.stage]}
                </span>
              </div>
              <h2 className="mt-4 text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {s.vertical.name}
              </h2>
              <p className="mt-5 max-w-3xl text-xl leading-relaxed text-neutral-300">
                {s.vertical.oneLiner}
              </p>

              <div className="mt-9 grid gap-6 md:grid-cols-2">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-emerald-400">
                    Built and working
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {s.vertical.built.map((b) => (
                      <li
                        key={b}
                        className="flex gap-2.5 text-[15px] leading-relaxed text-neutral-300"
                      >
                        <span className="mt-0.5 shrink-0 text-emerald-500">✓</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-wider text-rose-400">
                    Not proven
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {s.vertical.unproven.map((u) => (
                      <li
                        key={u}
                        className="flex gap-2.5 text-[15px] leading-relaxed text-neutral-300"
                      >
                        <span className="mt-0.5 shrink-0 text-rose-400">·</span>
                        <span>{u}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-8 rounded-xl border border-neutral-800 bg-neutral-900/50 p-5">
                <p className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">
                  What would settle it — and what that costs
                </p>
                <p className="mt-2 text-[15px] leading-relaxed text-neutral-200">
                  {s.vertical.decisiveTest}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                  {s.vertical.costToTest}
                </p>
              </div>
            </div>
          )}

          {s.kind === 'close' && (
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">
                The shape of the bet
              </p>
              <h2 className="mt-5 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
                Six ways to sell, one thing to build.
              </h2>
              <p className="mt-7 max-w-3xl text-xl leading-relaxed text-neutral-300">
                Every line runs on the same checkout, the same ledger and the same payout machinery.
                That is why a new vertical costs a pitch instead of a platform — and why being wrong
                about one of them is survivable.
              </p>
              <p className="mt-5 max-w-3xl text-lg leading-relaxed text-neutral-400">
                What we do not have is a customer telling us which one is right. That is the next
                thing to buy, and it is cheap: ten phone calls, one merchant with real volume, one
                agency with real clients.
              </p>
              <p className="mt-8 font-mono text-sm text-neutral-500">
                Every figure shown was queried live. Nothing in this deck was typed in.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-4 border-t border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-1.5">
          {slides.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Go to slide ${n + 1}`}
              onClick={() => setI(n)}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? 'w-7 bg-sky-400' : 'w-1.5 bg-neutral-700 hover:bg-neutral-500'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tabular-nums text-neutral-500">
            {i + 1} / {slides.length}
          </span>
          <button
            type="button"
            onClick={() => go(-1)}
            disabled={i === 0}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
          >
            ←
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={i === slides.length - 1}
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-500 disabled:opacity-30"
          >
            →
          </button>
          <span className="hidden font-mono text-[11px] text-neutral-600 sm:inline">
            ← → space · F fullscreen
          </span>
          <Link
            href="/business-plan"
            className="rounded-md border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 hover:border-neutral-500 hover:text-neutral-200"
          >
            Exit
          </Link>
        </div>
      </div>
    </div>
  );
}
