'use client';

// app/admin/revenue/page.tsx — platform revenue reconciliation (Model A, A5).
import * as React from 'react';

const fmt = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? 'bg-muted' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

export default function RevenuePage() {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [since, setSince] = React.useState('');

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const qs = since ? `?since=${encodeURIComponent(since)}` : '';
      const res = await fetch(`/api/admin/revenue${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'failed');
    }
  }, [since]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const comm = data?.commission_ledger_cents ?? {};
  const residual = data?.partner_residual_cents ?? {};

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Platform revenue</h1>

      <div className="mb-4 flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Since</label>
        <input
          type="date"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          className="rounded border px-2 py-1 text-sm"
        />
        <button onClick={() => void load()} className="rounded border px-3 py-1 text-sm">
          Refresh
        </button>
      </div>

      {error && <div className="mb-3 text-sm text-red-500">{error}</div>}

      {data && (
        <>
          {/* The headline money story: what QuickSites keeps, what it owes partners. */}
          <div className="grid grid-cols-2 gap-3">
            <Stat label="QuickSites net take" value={fmt(data.qs_net_cents)} highlight />
            <Stat label="Partners owed (unpaid)" value={fmt(residual.owed)} highlight />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Platform fees (gross)" value={fmt(data.platform_fee_cents)} />
            <Stat label="Partner residual paid" value={fmt(residual.paid)} />
            <Stat label="GMV (paid)" value={fmt(data.gmv_cents)} />
            <Stat label="Paid orders" value={String(data.orders.paid)} />
            <Stat label="Refunded orders" value={String(data.orders.refunded)} />
            <Stat label="Refunded fees" value={fmt(data.refunded_fee_cents)} />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Net take = gross platform fees on paid orders minus the partner share (owed + paid) accrued
            against them. Unattributed orders have no residual, so QuickSites keeps the full fee.
          </p>

          {Object.keys(comm).length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold">Commission ledger by status</h2>
              <ul className="text-sm">
                {Object.entries(comm).map(([k, v]: any) => (
                  <li key={k} className="flex justify-between border-b py-1">
                    <span className="capitalize">{k}</span>
                    <span>{fmt(v)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </main>
  );
}
