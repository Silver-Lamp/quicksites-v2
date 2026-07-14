'use client';

// app/admin/revenue/page.tsx — platform revenue reconciliation (Model A, A5).
import * as React from 'react';
import DomainCostSummary from '@/components/admin/domain-cost-summary';

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
  const [checking, setChecking] = React.useState(false);

  const load = React.useCallback(async (withStripe = false) => {
    setError(null);
    if (withStripe) setChecking(true);
    try {
      const params = new URLSearchParams();
      if (since) params.set('since', since);
      if (withStripe) params.set('stripe', '1');
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/revenue${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setChecking(false);
    }
  }, [since]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const comm = data?.commission_ledger_cents ?? {};
  const residual = data?.partner_residual_cents ?? {};
  const override = data?.hub_override_cents ?? { owed: 0, paid: 0, void: 0 };
  const hasOverride = (override.owed || 0) + (override.paid || 0) > 0;
  const stripeRec = data?.stripe_reconciliation ?? null;

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
        <button
          onClick={() => void load(true)}
          disabled={checking}
          className="rounded border px-3 py-1 text-sm disabled:opacity-50"
          title="Sum the live Stripe application_fee objects for this window and compare to our recorded fees"
        >
          {checking ? 'Checking Stripe…' : 'Cross-check with Stripe'}
        </button>
      </div>

      {error && <div className="mb-3 text-sm text-red-500">{error}</div>}

      {/* Domain renewal liability — the recurring cost that eats into net take. */}
      <DomainCostSummary className="mb-4" />

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
            {hasOverride && <Stat label="Hub overrides (owed)" value={fmt(override.owed)} />}
            {hasOverride && <Stat label="Hub overrides (paid)" value={fmt(override.paid)} />}
            <Stat label="GMV (paid)" value={fmt(data.gmv_cents)} />
            <Stat label="Paid orders" value={String(data.orders.paid)} />
            <Stat label="Refunded orders" value={String(data.orders.refunded)} />
            <Stat label="Refunded fees" value={fmt(data.refunded_fee_cents)} />
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            Net take = gross platform fees on paid orders minus the partner share (owed + paid){hasOverride ? ' and any hub override (owed + paid)' : ''} accrued
            against them{hasOverride ? '. Both the partner residual and the hub override come out of QuickSites’ share.' : '. Unattributed orders have no residual, so QuickSites keeps the full fee.'}
          </p>

          {stripeRec && (
            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold">Stripe cross-check</h2>
              {stripeRec.error ? (
                <div className="rounded-xl border p-4 text-sm text-red-500">Stripe lookup failed: {stripeRec.error}</div>
              ) : (
                <div
                  className={`rounded-xl border p-4 ${stripeRec.matched ? 'border-green-600/40' : 'border-amber-500/50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {stripeRec.matched ? '✓ Reconciled' : '⚠ Drift detected'}
                    </span>
                    <span className="text-sm tabular-nums">Δ {fmt(stripeRec.delta_cents)}</span>
                  </div>
                  <ul className="mt-3 space-y-1 text-sm">
                    <li className="flex justify-between border-b py-1">
                      <span className="text-muted-foreground">Stripe fees collected (gross)</span>
                      <span className="tabular-nums">{fmt(stripeRec.stripe_fee_gross_cents)}</span>
                    </li>
                    <li className="flex justify-between border-b py-1">
                      <span className="text-muted-foreground">Stripe fees reversed (refunds)</span>
                      <span className="tabular-nums">−{fmt(stripeRec.stripe_fee_refunded_cents)}</span>
                    </li>
                    <li className="flex justify-between border-b py-1">
                      <span className="font-medium">Stripe fees net</span>
                      <span className="tabular-nums font-medium">{fmt(stripeRec.stripe_fee_net_cents)}</span>
                    </li>
                    <li className="flex justify-between border-b py-1">
                      <span className="text-muted-foreground">Our recorded gross (paid orders)</span>
                      <span className="tabular-nums">{fmt(stripeRec.db_fee_gross_cents)}</span>
                    </li>
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Compares {stripeRec.fee_count} Stripe application_fee object(s) for this window against our
                    ledger. Stripe net should ≈ our recorded gross (a refunded order drops from both). Small deltas
                    can come from proportional refund-reversal rounding; a large Δ warrants a per-order look via{' '}
                    <code className="rounded bg-muted px-1">/api/admin/commerce/reconcile?stripe=1</code>.
                  </p>
                </div>
              )}
            </div>
          )}

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
