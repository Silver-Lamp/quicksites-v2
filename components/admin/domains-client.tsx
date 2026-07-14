'use client';

// components/admin/domains-client.tsx
//
// The owned-domain recurring-cost dashboard (/admin/domains). Rolls up what we pay to
// keep every geo/campaign/account domain, contrasts it with the rent we already collect,
// and projects the cumulative bleed forward so the "buy a lot, rank + rent them" thesis
// is visible. Non-Vercel domains whose cost we can't read from an API surface as a
// "needs cost" follow-up the operator fills in inline.

import { useCallback, useEffect, useState } from 'react';
import DomainSpendChart from '@/components/admin/domain-spend-chart';
import type { InventoryDomain, DomainRollup, SpendProjectionPoint } from '@/lib/domains/ownedInventory';

const fmt = (c: number) => {
  const d = (Number(c) || 0) / 100;
  return `$${d.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};
const fmtWhole = (c: number) => `$${Math.round((Number(c) || 0) / 100).toLocaleString()}`;

type Payload = {
  domains: InventoryDomain[];
  rollup: DomainRollup;
  projection: SpendProjectionPoint[];
  projectionByExpiry: SpendProjectionPoint[];
  vercelUnavailable: boolean;
};

type SpendMode = 'amortized' | 'expiry';

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'amber' | 'emerald' | 'neutral' }) {
  const valueCls = tone === 'amber' ? 'text-amber-300' : tone === 'emerald' ? 'text-emerald-300' : 'text-white';
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="text-xs text-neutral-400">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${valueCls}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div> : null}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = { vercel: 'Vercel', campaign: 'Campaign', external: 'External', manual: 'Manual' };

function statusPill(d: InventoryDomain) {
  if (d.rented) return <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] text-emerald-300">Rented · {fmtWhole(d.monthlyRentCents)}/mo</span>;
  if (d.ranking) return <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[11px] text-sky-300">Ranking — rent it</span>;
  return <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] text-neutral-500">Idle</span>;
}

export default function DomainsClient() {
  const [data, setData] = useState<Payload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [spendMode, setSpendMode] = useState<SpendMode>('amortized');

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch('/api/admin/domains', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || `failed (${res.status})`);
      setData(json);
    } catch (e: any) {
      setErr(e?.message || 'failed');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function sync() {
    setBusy('sync');
    setMsg(null);
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync' }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error === 'vercel_unavailable' ? 'Vercel not reachable — set VERCEL_TOKEN' : (json?.error || 'sync failed'));
      setMsg(`Synced ${json.found} Vercel domain(s), priced ${json.priced}.`);
      await load();
    } catch (e: any) {
      setMsg(e?.message || 'sync failed');
    } finally {
      setBusy(null);
    }
  }

  async function setCost(d: InventoryDomain) {
    const cur = d.renewalCents != null ? String(Math.round(d.renewalCents / 100)) : '';
    const input = window.prompt(`Yearly renewal cost for ${d.domain} (USD). Leave blank to clear.`, cur);
    if (input === null) return;
    const trimmed = input.trim();
    setBusy(`cost:${d.domain}`);
    setMsg(null);
    try {
      const res = await fetch('/api/admin/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: d.domain,
          renewalCents: trimmed === '' ? null : Math.round(Number(trimmed) * 100),
          registrar: d.registrar ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'save failed');
      await load();
    } catch (e: any) {
      setMsg(e?.message || 'save failed');
    } finally {
      setBusy(null);
    }
  }

  if (err) return <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>;
  if (!data) return <div className="py-16 text-center text-sm text-neutral-500">Loading domains…</div>;

  const r = data.rollup;
  const netProfit = r.netMonthlyCents < 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Domain costs</h1>
          <p className="mt-1 text-sm text-neutral-400">
            What it costs to keep every domain we own — and how far ranking + renting closes the gap.
          </p>
        </div>
        <button
          onClick={sync}
          disabled={busy === 'sync'}
          title="Pull the Vercel account domain list + live renewal prices into the cost ledger"
          className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-sm font-medium text-sky-200 hover:bg-sky-500/20 disabled:opacity-50"
        >
          {busy === 'sync' ? 'Syncing…' : '↻ Sync from Vercel'}
        </button>
      </div>

      {msg && <div className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-4 py-2 text-sm text-neutral-200">{msg}</div>}
      {data.vercelUnavailable && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
          Vercel account list unavailable (set VERCEL_TOKEN) — showing campaign + manually-tracked domains only.
        </div>
      )}

      {/* Roll-up */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Domains owned" value={String(r.count)} sub={r.withUnknownCost ? `${r.withUnknownCost} need a cost` : 'all costs known'} />
        <Stat label="Monthly run-rate" value={fmt(r.monthlyCents)} sub={`${fmtWhole(r.yearlyCents)}/yr`} tone="amber" />
        <Stat label="Rent offset" value={`${fmt(r.rentedMonthlyRentCents)}/mo`} sub={`${r.rentedCount} rented`} tone="emerald" />
        <Stat
          label={netProfit ? 'Net monthly (profit)' : 'Net monthly cost'}
          value={`${netProfit ? '+' : ''}${fmt(Math.abs(r.netMonthlyCents))}`}
          sub="cost − rent"
          tone={netProfit ? 'emerald' : 'amber'}
        />
        <Stat label="Not yet earning" value={String(r.idleCount + r.rankingCount)} sub={`${r.rankingCount} ranking · ${r.idleCount} idle`} />
      </div>

      {/* Forward-looking projection */}
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-semibold text-neutral-200">If you don't rank + rent them</div>
          <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/60 p-0.5 text-xs">
            <button
              onClick={() => setSpendMode('amortized')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${spendMode === 'amortized' ? 'bg-sky-500 text-zinc-950' : 'text-neutral-300 hover:text-white'}`}
              title="Spread each renewal evenly across the year (smooth run-rate)"
            >
              Amortized
            </button>
            <button
              onClick={() => setSpendMode('expiry')}
              className={`rounded-md px-2.5 py-1 font-medium transition ${spendMode === 'expiry' ? 'bg-sky-500 text-zinc-950' : 'text-neutral-300 hover:text-white'}`}
              title="Show each renewal in the month it actually falls due (lumpy — some months spike)"
            >
              By renewal date
            </button>
          </div>
        </div>
        <p className="mb-3 text-xs text-neutral-500">
          {spendMode === 'amortized'
            ? "Cumulative renewal spend over the next 12 months at today's run-rate (each renewal spread evenly). The emerald line nets out the rent you already collect — the goal is to push it below zero by ranking idle domains and renting them."
            : 'Cumulative spend with each renewal landing in the month it actually falls due — so months with a cluster of renewals step up sharply. Domains with no known expiry date are spread evenly.'}
        </p>
        <DomainSpendChart points={spendMode === 'expiry' ? data.projectionByExpiry : data.projection} />
      </div>

      {/* Inventory table */}
      <div className="overflow-x-auto rounded-xl border border-neutral-800">
        <table className="min-w-full text-sm">
          <thead className="bg-neutral-900">
            <tr className="text-left [&>th]:px-4 [&>th]:py-2 [&>th]:font-medium [&>th]:text-neutral-400">
              <th>Domain</th><th>Source</th><th>Renewal / yr</th><th>Expires</th><th>Status</th><th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {data.domains.map((d) => {
              const unknown = d.renewalCents == null;
              return (
                <tr key={d.domain} className="[&>td]:px-4 [&>td]:py-2">
                  <td className="font-mono text-xs text-sky-300">
                    {d.domain}
                    {d.city && <span className="ml-2 text-[11px] text-neutral-500">{d.city}</span>}
                  </td>
                  <td className="text-xs text-neutral-400">
                    {SOURCE_LABEL[d.source] ?? d.source}
                    {d.registrar && d.registrar !== d.source ? <span className="text-neutral-600"> · {d.registrar}</span> : null}
                  </td>
                  <td className="text-xs">
                    {unknown ? (
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300">needs cost</span>
                    ) : (
                      <span className="text-neutral-200">{fmtWhole(d.renewalCents!)}</span>
                    )}
                  </td>
                  <td className="text-xs text-neutral-500">{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—'}</td>
                  <td>{statusPill(d)}</td>
                  <td className="text-right">
                    <button
                      onClick={() => setCost(d)}
                      disabled={busy === `cost:${d.domain}`}
                      className="text-xs text-sky-400 hover:text-sky-300 disabled:opacity-50"
                    >
                      {busy === `cost:${d.domain}` ? '…' : unknown ? 'Add cost' : 'Edit cost'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {data.domains.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-neutral-500">No owned domains yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
