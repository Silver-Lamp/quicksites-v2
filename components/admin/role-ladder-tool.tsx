'use client';

// components/admin/role-ladder-tool.tsx
//
// HOW DEEP THE CHAIN GOES, WHAT EACH RUNG IS CALLED, WHAT THEY DO, AND WHAT THEY EARN.
//
// Built after the 2026-09-30 call, where the same person described himself as the white-label
// company and as someone who would not support merchants — two rungs with a 3× pay difference,
// and neither of us caught it because the words were not settled.
//
// ⚠️ IT RUNS THE REAL ALLOCATOR. Every figure comes from `applyLadderScenario`, which calls the
// same `allocateUplineOverrides` the Stripe webhook calls. A diagram that approximated the
// payout would be worse than none: it would let someone promise a rate the system then refuses.
//
// ⚠️ IT MARKS WHICH NAMES ARE REAL. Three rungs have names the code actually branches on; the
// rest are proposals. A name that exists only in a diagram becomes a promise the moment it is
// quoted to a partner, so the page says which is which instead of presenting one vocabulary.
import * as React from 'react';
import {
  applyLadderScenario,
  ladderMermaid,
  ISO_PERSONAS,
  SOLO_PERSONAS,
  MAX_UPLINE_DEPTH,
  SALE_PRESETS,
  MONTH_PRESETS,
  type SellerTier,
} from '@/lib/commerce/roleLadder';

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const pctLabel = (n: number) => `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`;

type Preset = 'iso' | 'solo';

/**
 * Who is reading.
 *
 * ⚠️ THE DIFFERENCE IS NOT TONE, IT IS WHICH TRUTHS ARE USEFUL. Internally the interesting fact
 * is that three rung names are real and the rest are proposals, quoted with the column they come
 * from — that is a note to whoever changes the vocabulary next. A partner reading
 * `referral_codes.owner_type` learns nothing and may reasonably read it as unfinished.
 *
 * ⚠️ But the caveat itself is NOT dropped for partners, only reworded. Hiding it would let a
 * name that exists in a diagram and nowhere else get quoted back to us as a commitment, which
 * is the precise risk the marking exists for. Same fact, audience-appropriate words.
 */
export type LadderAudience = 'internal' | 'partner';

export default function RoleLadderTool({
  maxFeePercent,
  audience = 'internal',
}: {
  maxFeePercent: number;
  audience?: LadderAudience;
}) {
  const [preset, setPreset] = React.useState<Preset>('iso');
  const [tier, setTier] = React.useState<SellerTier>('origination');
  // ⚠️ One sale vs a month of them. Amy asked about a $25 candle; a monthly-volume slider
  // answers a different question and hides the uncomfortable one — at $25 the whole platform
  // fee is $1.25 and four people are dividing it.
  const [basis, setBasis] = React.useState<'sale' | 'month'>('sale');
  const [volume, setVolume] = React.useState(2500);
  const [feePercent, setFeePercent] = React.useState(0.05);
  const [shares, setShares] = React.useState<number[]>([0.1, 0.1, 0.1]);
  const [copied, setCopied] = React.useState(false);

  const personas = preset === 'iso' ? ISO_PERSONAS : SOLO_PERSONAS;

  const result = React.useMemo(
    () => applyLadderScenario({ monthlyVolumeCents: volume, feePercent, tier, uplineShares: shares, personas }),
    [volume, feePercent, tier, shares, personas],
  );
  // ⚠️ The diagram carries the same basis as the table. A chart labelled "per month" showing
  // per-sale cents is the kind of thing that gets pasted into a deck and believed.
  const mermaid = React.useMemo(
    () => ladderMermaid(result, { monthlyLabel: basis === 'sale' ? 'on this sale' : 'per month' }),
    [result, basis],
  );

  const applyPreset = (p: Preset) => {
    setPreset(p);
    // The ISO chain has one more rung than the solo one: the sales org sits between the closer
    // and the hub. Switching preset changes the shape, not just the labels.
    setShares(p === 'iso' ? [0.1, 0.1, 0.1] : [0.05, 0.05]);
    setTier(p === 'iso' ? 'origination' : 'operator');
  };

  const setShare = (i: number, v: number) => setShares((s) => s.map((x, j) => (j === i ? v : x)));
  const addLevel = () => setShares((s) => (s.length >= MAX_UPLINE_DEPTH ? s : [...s, 0.05]));
  const dropLevel = () => setShares((s) => s.slice(0, -1));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {(['iso', 'solo'] as const).map((p) => (
            <button
              key={p} type="button" onClick={() => applyPreset(p)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${preset === p ? 'bg-sky-500/20 text-sky-200' : 'text-muted-foreground hover:bg-muted'}`}
            >
              {p === 'iso' ? 'ISO with a sales force' : 'Solo operator'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {(basis === 'sale' ? SALE_PRESETS : MONTH_PRESETS).map((x) => (
            <button
              key={x.label} type="button" onClick={() => setVolume(x.cents)}
              className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                volume === x.cents
                  ? 'border-sky-500/50 bg-sky-500/15 text-sky-200'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              {x.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              const next = basis === 'sale' ? 'month' : 'sale';
              setBasis(next);
              setVolume(next === 'sale' ? SALE_PRESETS[0].cents : MONTH_PRESETS[1].cents);
            }}
            className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted"
          >
            {basis === 'sale' ? 'show a whole month →' : '← show one sale'}
          </button>
        </div>

        <label className="text-sm">
          <span className="block text-xs text-muted-foreground">
            {basis === 'sale' ? 'One sale' : 'A month of sales'}
          </span>
          <input
            type="range"
            min={basis === 'sale' ? 500 : 50_000}
            max={basis === 'sale' ? 50_000 : 5_000_000}
            step={basis === 'sale' ? 500 : 50_000}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-44"
          />
          <span className="ml-2 tabular-nums font-medium">{usd(volume)}</span>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground">Platform fee</span>
          <input type="range" min={0.005} max={maxFeePercent} step={0.005} value={feePercent}
            onChange={(e) => setFeePercent(Number(e.target.value))} className="w-32" />
          <span className="ml-2 tabular-nums font-medium">{pctLabel(feePercent)}</span>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground">Who supports the merchant</span>
          <select value={tier} onChange={(e) => setTier(e.target.value as SellerTier)}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm">
            <option value="operator">The seller does — Operator</option>
            <option value="origination">We do — Originator</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rung</th>
              <th className="px-3 py-2">What they do</th>
              <th className="px-3 py-2">Override</th>
              <th className="px-3 py-2 text-right">{basis === 'sale' ? 'Earns on this sale' : 'Earns / month'}</th>
            </tr>
          </thead>
          <tbody>
            {result.rungs.map((r, i) => {
              const uplineIdx = i - 2;
              return (
                <tr key={r.level} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <span className="block font-medium">{r.persona ?? r.name}</span>
                    <span className="block text-xs text-muted-foreground">{r.name}</span>
                    {/* ⚠️ The honest bit: three of these names are real, the rest are proposals.
                        Reworded for a partner, never removed — a name that exists only in a
                        diagram must not come back to us quoted as a commitment. */}
                    {r.established ? (
                      audience === 'internal' ? (
                        <span className="mt-0.5 block text-[10px] text-emerald-400/80">{r.established}</span>
                      ) : null
                    ) : (
                      <span className="mt-0.5 block text-[10px] text-amber-300">
                        {audience === 'internal'
                          ? 'no name for this rung exists in the system — proposed here only'
                          : 'levels this deep are supported, but we have not settled a name or a rate for them — ask'}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.does}
                    <span className="mt-1 block text-muted-foreground/70">{r.paidBy}</span>
                  </td>
                  <td className="px-3 py-2">
                    {uplineIdx >= 0 && uplineIdx < shares.length ? (
                      <>
                        <input type="range" min={0} max={0.25} step={0.005} value={shares[uplineIdx]}
                          onChange={(e) => setShare(uplineIdx, Number(e.target.value))} className="w-28" />
                        <span className="ml-2 text-xs tabular-nums text-muted-foreground">
                          {pctLabel(shares[uplineIdx])}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${r.shorted ? 'text-rose-400' : ''}`}>
                    {r.level === 0 ? (
                      <span className="text-muted-foreground">pays {usd(result.feeCents)}</span>
                    ) : r.shorted ? (
                      'nothing'
                    ) : (
                      usd(r.cents ?? 0)
                    )}
                  </td>
                </tr>
              );
            })}
            {/* ⚠️ The house row stays on the partner view too. /for-amy's own voice settled
                this: "a constraint you can see is easier to trust than one I assert." Hiding
                what we keep would make the pool look like a number we chose rather than one
                that has to cover running the platform. */}
            <tr className="border-t border-border bg-muted/30">
              <td className="px-3 py-2 font-medium">QuickSites</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {tier === 'origination'
                  ? 'Supports the merchant, because nobody in the chain does.'
                  : 'Runs the platform; the operator supports the merchant.'}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                pool {pctLabel(result.poolCents / Math.max(1, result.feeCents))} of fee
              </td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${result.houseCents <= 0 ? 'text-rose-400' : ''}`}>
                {usd(result.houseCents)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={addLevel} disabled={shares.length >= MAX_UPLINE_DEPTH}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40">
          + add a level above
        </button>
        <button type="button" onClick={dropLevel} disabled={shares.length <= 0}
          className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40">
          − remove one
        </button>
        <span className="text-xs text-muted-foreground">
          {shares.length} above the sale · hard ceiling {MAX_UPLINE_DEPTH}
          {shares.length >= MAX_UPLINE_DEPTH ? ' (reached)' : ''}
        </span>
      </div>

      {/* ⚠️ Nearest-first: the shortfall always lands furthest from the sale. Said in words,
          because a row reading "nothing" is easy to mistake for a rate someone chose. */}
      {result.shortedNames.length > 0 ? (
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          <strong>{result.shortedNames.join(', ')}</strong> would be paid <strong>nothing</strong>.
          Overrides pay nearest the sale first, so when the pool runs out it is always the people
          furthest up — usually whoever recruited the chain — who get zero, never a reduced rate.
        </p>
      ) : null}
      {/* ⚠️ THE ANSWER TO THE QUESTION AMY ACTUALLY ASKED, and the one a monthly-volume slider
          hides. On her own example — a $25 candle — the whole platform fee is $1.25 and each
          upline earns about twelve cents. That is not a bug in the model; it is the model
          telling you which merchants a multi-level chain can carry. Fires on the number rather
          than being written into prose, so it cannot be true on a page that does not say it. */}
      {basis === 'sale' && (result.rungs[result.rungs.length - 1]?.cents ?? 0) > 0 &&
      (result.rungs[result.rungs.length - 1]?.cents ?? 0) < 25 ? (
        <p className="rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-100">
          At this order size the chain pays the top rung{' '}
          <strong>{usd(result.rungs[result.rungs.length - 1]?.cents ?? 0)}</strong> — cents, not
          dollars. Nothing is broken: a {usd(volume)} sale only generates a{' '}
          {usd(result.feeCents)} fee, and four people are dividing it. What it tells you is{' '}
          <strong>which merchants a chain this deep can carry</strong>. Switch to a whole month,
          or point the chain at merchants doing real volume — that is the business this model is
          built for, and a craft shop selling a few candles is not it.
        </p>
      ) : null}

      {result.houseCents <= 0 ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          QuickSites earns nothing on this order
          {tier === 'origination' ? ' — while still supporting the merchant.' : '.'}
        </p>
      ) : null}

      <details className="rounded-xl border border-border">
        <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium">
          Mermaid diagram — paste into a deck, GitHub or Notion
        </summary>
        <div className="border-t border-border p-3">
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(mermaid).then(
                () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
                () => setCopied(false),
              );
            }}
            className="mb-2 rounded-md border border-sky-500/40 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-200 hover:bg-sky-500/20"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          {/* Generated from the same result the table renders — a diagram maintained apart from
              the numbers drifts from them, and this one is meant to travel. */}
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-[11px] leading-relaxed">
            {mermaid}
          </pre>
        </div>
      </details>
    </div>
  );
}
