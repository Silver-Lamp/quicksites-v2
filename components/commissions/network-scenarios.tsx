'use client';

// components/commissions/network-scenarios.tsx
//
// "HOW MUCH CAN I MAKE ON VOLUME" — the question from the 2026-09-30 call, which could not be
// answered live because the numbers lived in four modules.
//
// ⚠️ DEPTH DOES NOT REDUCE YOUR RATE — IT MOVES YOU TOWARD A CLIFF. The first version of this
// file claimed an extra level between you and the sale pays you less. Running it showed that is
// FALSE: an override is a share of the FEE, so a middle level at 5%, 10% or 18% leaves your 5%
// untouched. What depth actually does is consume the shared pool faster, and when the pool runs
// out the allocator pays nearest-first — so you do not get less, you get NOTHING.
//
// Measured on a $500 fee: on the origination tier (pool $200) a middle level at 18% plus your
// 5% both pay in full. On the operator tier (pool $100) the same rates pay the middle $90 and
// you zero. Same rates, same depth — the tier decides whether there is a cliff at all.
//
// A slope would be survivable and visible in a number. A cliff is neither, which is why it is
// the thing this component is built to show.
//
// ⚠️ Every figure runs the REAL allocator (`applyLadderScenario` → `allocateUplineOverrides`),
// the same one the Stripe webhook calls. An approximation here would let someone promise a rate
// the system then refuses to pay.
import * as React from 'react';
import { applyLadderScenario, type SellerTier } from '@/lib/commerce/roleLadder';

const usd = (c: number) =>
  c >= 100_000 ? `$${Math.round(c / 100).toLocaleString()}` : `$${(c / 100).toFixed(2)}`;
const pctLabel = (n: number) => `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`;

type Shape = 'solo' | 'iso';

export default function NetworkScenarios({ maxFeePercent }: { maxFeePercent: number }) {
  const [shape, setShape] = React.useState<Shape>('iso');
  const [count, setCount] = React.useState(5);
  const [perNode, setPerNode] = React.useState(10);
  const [volume, setVolume] = React.useState(1_000_000);
  const [feePercent, setFeePercent] = React.useState(0.05);
  const [yourShare, setYourShare] = React.useState(0.05);
  const [middleShare, setMiddleShare] = React.useState(0.05);
  const [tier, setTier] = React.useState<SellerTier>('origination');

  const per = React.useMemo(() => {
    // Solo: you sit directly above the seller. ISO: the sales org sits between you and the rep,
    // so your override is the SECOND link and is paid after theirs — nearest-first.
    const uplineShares = shape === 'solo' ? [yourShare] : [middleShare, yourShare];
    return applyLadderScenario({
      monthlyVolumeCents: volume,
      feePercent,
      tier,
      uplineShares,
    });
  }, [shape, volume, feePercent, tier, yourShare, middleShare]);

  // Your rung is the last one in the chain either way.
  const yourRung = per.rungs[per.rungs.length - 1];
  const yourPerMerchant = yourRung?.cents ?? 0;
  const merchants = count * perNode;
  const monthly = yourPerMerchant * merchants;

  return (
    <div className="space-y-5">
      <div className="flex gap-1 rounded-lg border border-zinc-800 p-1">
        {(['solo', 'iso'] as const).map((s) => (
          <button
            key={s} type="button" onClick={() => setShape(s)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              shape === s ? 'bg-emerald-500/20 text-emerald-200' : 'text-zinc-500 hover:bg-zinc-900'
            }`}
          >
            {s === 'solo' ? 'Independent operators you recruit' : 'ISOs, each with their own reps'}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label={shape === 'solo' ? 'Operators you recruit' : 'ISOs you recruit'}
          min={1} max={50} step={1} value={count} onChange={setCount} display={String(count)} />
        <Slider label={shape === 'solo' ? 'Merchants each one signs' : 'Merchants per ISO'}
          min={1} max={200} step={1} value={perNode} onChange={setPerNode} display={String(perNode)} />
        <Slider label="Merchant volume / month" min={100000} max={5000000} step={100000}
          value={volume} onChange={setVolume} display={usd(volume)} />
        <Slider label="Platform fee" min={0.005} max={maxFeePercent} step={0.005}
          value={feePercent} onChange={setFeePercent} display={pctLabel(feePercent)} />
        <Slider label="Your override" min={0} max={0.2} step={0.005}
          value={yourShare} onChange={setYourShare} display={pctLabel(yourShare)} />
        {shape === 'iso' ? (
          <Slider label="The ISO's override" min={0} max={0.2} step={0.005}
            value={middleShare} onChange={setMiddleShare} display={pctLabel(middleShare)} />
        ) : (
          <label className="text-sm">
            <span className="block text-xs text-zinc-500">Who supports the merchant</span>
            <select value={tier} onChange={(e) => setTier(e.target.value as SellerTier)}
              className="mt-1 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-sm">
              <option value="operator">They do — Operator</option>
              <option value="origination">QuickSites does — Originator</option>
            </select>
          </label>
        )}
      </div>

      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.06] p-4">
        <p className="text-xs uppercase tracking-wide text-emerald-400">You earn</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums text-white">
          {usd(monthly)}<span className="text-base font-normal text-zinc-400"> / month</span>
        </p>
        <p className="mt-1 text-sm text-zinc-400">
          {usd(yourPerMerchant)} per merchant × {merchants.toLocaleString()} merchants
          {shape === 'iso' ? ` (${count} ISOs × ${perNode})` : ` (${count} × ${perNode})`}. Recurring,
          for the life of each account.
        </p>
        {yourRung?.shorted ? (
          // ⚠️ Nearest-first: when the pool runs out it is always the person furthest from the
          // sale who gets zero — and in the ISO shape that is you, not the ISO.
          <p className="mt-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
            At these rates <strong>you would be paid nothing</strong>. Overrides pay nearest the
            sale first, so the ISO&rsquo;s cut is taken before yours and you are the one who runs
            out. Lower their rate, raise the fee, or take the shallower shape.
          </p>
        ) : null}
      </div>

      {/* ⚠️ The comparison that matters, and the reason both shapes are on one screen. */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-400">
        <p>
          <strong className="text-zinc-200">An extra level does not shrink your rate — it
          moves you toward a cliff.</strong>{' '}
          Your override is a share of the fee, so whether the ISO takes 5% or 18%, your 5% is
          still 5%. What their cut does is use up the pool everyone above the sale shares. While
          it fits, you are paid in full. When it stops fitting you are not paid less —{' '}
          <strong className="text-zinc-200">you are paid nothing</strong>, because the allocator
          pays nearest the sale first and you are furthest from it.
        </p>
        <p className="mt-2">
          {tier === 'operator' ? (
            <>
              On this tier the pool is the smaller one, so the cliff is close: an ISO at 18% plus
              your 5% already goes over, and you would earn zero on every one of those merchants.
            </>
          ) : (
            <>
              On this tier the pool is the larger one — the seller keeps less because we support
              the merchant — so the same rates that would zero you on the other tier fit
              comfortably here.
            </>
          )}
        </p>
        <p className="mt-2">
          The trade is reach: one ISO conversation can put a sales force to work, where operators
          are recruited one at a time. This is the arithmetic of that trade, not an argument
          against it.
        </p>
      </div>
    </div>
  );
}

function Slider({
  label, min, max, step, value, onChange, display,
}: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (n: number) => void; display: string;
}) {
  return (
    <label className="text-sm">
      <span className="flex items-baseline justify-between text-xs text-zinc-500">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-zinc-300">{display}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full" />
    </label>
  );
}
