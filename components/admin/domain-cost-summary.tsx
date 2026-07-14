'use client';

// components/admin/domain-cost-summary.tsx
//
// Compact "what are my domains costing me" bar, reused wherever the number is relevant
// (the growth/prospects page next to the buy-list planner, and the revenue page next to
// net take). Fetches the same /api/admin/domains rollup as the dashboard; renders nothing
// until it has data (so it never flashes an empty shell) and links to the full cost view.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DomainRollup } from '@/lib/domains/ownedInventory';

const fmt = (c: number) => `$${((Number(c) || 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtWhole = (c: number) => `$${Math.round((Number(c) || 0) / 100).toLocaleString()}`;

export default function DomainCostSummary({ className = '' }: { className?: string }) {
  const [rollup, setRollup] = useState<DomainRollup | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/admin/domains', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (alive && j?.ok && j.rollup) setRollup(j.rollup); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!rollup || rollup.count === 0) return null;
  const netProfit = rollup.netMonthlyCents < 0;

  return (
    <Link
      href="/admin/domains/costs"
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-neutral-800 bg-neutral-900/40 px-4 py-3 text-sm transition hover:border-neutral-700 ${className}`}
      title="Open the domain cost dashboard"
    >
      <span className="font-medium text-white">💸 {rollup.count} domains</span>
      <span className="text-amber-300">{fmt(rollup.monthlyCents)}/mo</span>
      <span className="text-neutral-500">({fmtWhole(rollup.yearlyCents)}/yr to renew)</span>
      {rollup.rentedMonthlyRentCents > 0 && (
        <span className="text-emerald-300">− {fmt(rollup.rentedMonthlyRentCents)}/mo rented</span>
      )}
      <span className={netProfit ? 'text-emerald-300' : 'text-neutral-300'}>
        = {netProfit ? '+' : ''}{fmt(Math.abs(rollup.netMonthlyCents))}/mo net
      </span>
      {(rollup.idleCount > 0 || rollup.withUnknownCost > 0) && (
        <span className="text-amber-400/80">
          ⚠ {rollup.idleCount > 0 ? `${rollup.idleCount} idle` : ''}
          {rollup.idleCount > 0 && rollup.withUnknownCost > 0 ? ' · ' : ''}
          {rollup.withUnknownCost > 0 ? `${rollup.withUnknownCost} need cost` : ''}
        </span>
      )}
      <span className="ml-auto text-xs text-sky-400">View →</span>
    </Link>
  );
}
