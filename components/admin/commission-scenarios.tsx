'use client';

// components/admin/commission-scenarios.tsx
//
// MOVE THE SPLITS AND WATCH WHO GETS PAID. Built for the Daryle call (2026-09-30): an ISO
// channel wants three levels above the sale, and the question on the table is "how much can my
// people make" — which nobody could answer, because the numbers lived in four modules and a
// spreadsheet nobody had.
//
// ⚠️ IT RUNS THE REAL ALLOCATOR, NOT A MODEL OF IT. `allocateUplineOverrides` is the same pure
// function `markOrderPaid` calls on a live order, so what this panel shows is what would
// actually post to `commission_ledger`. A panel that approximated the payout would be worse
// than no panel: it would let someone promise a rate the system then refuses to pay.
//
// ⚠️ It shows the SHORTFALL rather than hiding it. Nearest-first means a level that does not fit
// is paid nothing, so the person furthest from the sale — usually the one who recruited everyone
// — is the first to earn zero. That is the single most counter-intuitive thing about the design
// and the panel exists largely to make it visible before it is promised away.
import { useMemo, useState } from 'react';
import {
  buildUplineChain,
  allocateUplineOverrides,
  type CodeNode,
} from '@/lib/commerce/uplineChain';

const usd = (c: number) => `$${(c / 100).toFixed(2)}`;
const pct = (n: number) => `${(n * 100).toFixed(1).replace(/\.0$/, '')}%`;

type Level = { code: string; label: string; share: number };

export default function CommissionScenarios({
  maxFeePercent,
  operatorShare,
  affiliateShare,
  operatorPool,
  originationPool,
}: {
  maxFeePercent: number;
  operatorShare: number;
  affiliateShare: number;
  operatorPool: number;
  originationPool: number;
}) {
  const [orderCents, setOrderCents] = useState(5000);
  const [feePercent, setFeePercent] = useState(maxFeePercent);
  const [tier, setTier] = useState<'operator' | 'origination'>('origination');
  const [levels, setLevels] = useState<Level[]>([
    { code: 'iso', label: 'ISO / sales org', share: 0.05 },
    { code: 'daryle', label: 'Channel recruiter', share: 0.05 },
    { code: 'amy', label: 'Referred the channel', share: 0.05 },
  ]);

  const result = useMemo(() => {
    const fee = Math.round(orderCents * feePercent);
    const closerShare = tier === 'operator' ? operatorShare : affiliateShare;
    const closer = Math.floor(fee * closerShare);
    const pool = tier === 'operator' ? operatorPool : originationPool;

    // The chain is built from the selling code upward, exactly as the payout path does it.
    const nodes: Record<string, CodeNode> = { closer: { parentCode: levels[0]?.code ?? null, overrideShare: levels[0]?.share ?? 0 } };
    levels.forEach((l, i) => {
      const next = levels[i + 1];
      nodes[l.code] = { parentCode: next?.code ?? null, overrideShare: next?.share ?? 0 };
    });
    const chain = buildUplineChain('closer', (c) => nodes[c]);
    const alloc = allocateUplineOverrides(fee, chain, pool);
    return { fee, closer, pool, alloc, house: fee - closer - alloc.totalCents };
  }, [orderCents, feePercent, tier, levels, operatorShare, affiliateShare, operatorPool, originationPool]);

  const setShare = (i: number, v: number) =>
    setLevels((ls) => ls.map((l, j) => (j === i ? { ...l, share: v } : l)));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-5">
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground">Order</span>
          <input
            type="range" min={1000} max={200000} step={1000}
            value={orderCents} onChange={(e) => setOrderCents(Number(e.target.value))}
            className="w-52"
          />
          <span className="ml-2 tabular-nums font-medium">{usd(orderCents)}</span>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground">Platform fee</span>
          <input
            type="range" min={0} max={maxFeePercent} step={0.005}
            value={feePercent} onChange={(e) => setFeePercent(Number(e.target.value))}
            className="w-40"
          />
          <span className="ml-2 tabular-nums font-medium">{pct(feePercent)}</span>
        </label>
        <label className="text-sm">
          <span className="block text-xs text-muted-foreground">Who sold it</span>
          <select
            value={tier} onChange={(e) => setTier(e.target.value as 'operator' | 'origination')}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
          >
            <option value="operator">Operator — supports the merchant ({pct(operatorShare)})</option>
            <option value="origination">Origination — closes and moves on ({pct(affiliateShare)})</option>
          </select>
        </label>
      </div>

      <div className="rounded-xl border border-border">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b border-border">
              <td className="px-3 py-2 text-muted-foreground">Platform fee</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium">{usd(result.fee)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">{pct(feePercent)} of {usd(orderCents)}</td>
            </tr>
            <tr className="border-b border-border">
              <td className="px-3 py-2">Whoever closed it</td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-emerald-400">{usd(result.closer)}</td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {tier === 'operator' ? 'and supports the merchant' : 'we support the merchant'}
              </td>
            </tr>
            {levels.map((l, i) => {
              const paid = result.alloc.payments.find((p) => p.code === l.code);
              const short = result.alloc.shorted.find((s) => s.code === l.code);
              return (
                <tr key={l.code} className="border-b border-border">
                  <td className="px-3 py-2">
                    <span className="block">{l.label}</span>
                    <input
                      type="range" min={0} max={0.2} step={0.005}
                      value={l.share} onChange={(e) => setShare(i, Number(e.target.value))}
                      className="w-40"
                    />
                    <span className="ml-2 text-xs tabular-nums text-muted-foreground">{pct(l.share)} of fee</span>
                  </td>
                  <td className={`px-3 py-2 text-right tabular-nums font-medium ${short ? 'text-rose-400' : ''}`}>
                    {usd(paid?.cents ?? 0)}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {short ? (
                      <span className="text-rose-400">
                        ⚠️ paid nothing — the pool ran out before reaching this level
                      </span>
                    ) : (
                      <span className="text-muted-foreground">of a {pct(result.pool)} pool</span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr>
              <td className="px-3 py-2 font-medium">QuickSites keeps</td>
              <td className={`px-3 py-2 text-right tabular-nums font-medium ${result.house <= 0 ? 'text-rose-400' : 'text-foreground'}`}>
                {usd(result.house)}
              </td>
              <td className="px-3 py-2 text-xs text-muted-foreground">
                {tier === 'origination' ? 'and pays for supporting this merchant' : 'the merchant is supported by the operator'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {result.alloc.shorted.length > 0 ? (
        // ⚠️ Nearest-first, so the shortfall always lands on the person furthest from the sale —
        // typically whoever recruited the whole chain. Said plainly, because it is the opposite
        // of what anyone assumes and it is not fixable by a cleverer allocator.
        <p className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
          {result.alloc.shorted.length} level(s) would be paid <strong>nothing</strong>. Overrides
          pay nearest the sale first, so the shortfall lands on whoever is furthest up — usually
          the person who recruited the chain. Lower the per-level rates, raise the fee, or widen
          the pool.
        </p>
      ) : null}

      {result.house <= 0 ? (
        <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          QuickSites earns nothing on this order{tier === 'origination' ? ' — while still supporting the merchant' : ''}.
        </p>
      ) : null}
    </div>
  );
}
