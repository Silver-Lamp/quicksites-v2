'use client';

// app/admin/revenue/page.tsx — platform revenue reconciliation (Model A, A5).
// Every stat card is clickable: it expands a drill-down panel with the underlying
// rows (orders / commission-ledger entries via /api/admin/revenue/detail) or, for
// net take, the arithmetic that produced the number.
import * as React from 'react';
import DomainCostSummary from '@/components/admin/domain-cost-summary';

const fmt = (c: number) => `$${((Number(c) || 0) / 100).toFixed(2)}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : '—');

// ---- Drill-down wiring -------------------------------------------------------

type DetailKind = 'paid_orders' | 'refunded_orders' | 'commissions';

type OrderRow = {
  id: string;
  merchant: string;
  site_slug: string;
  total_cents: number;
  platform_fee_cents: number;
  tax_cents: number;
  created_at: string | null;
};

type CommissionRow = {
  id: string;
  referral_code: string;
  kind: 'residual' | 'override';
  subject_id: string;
  amount_cents: number;
  status: string;
  created_at: string | null;
};

type DetailPayload = { rows: any[]; total: number; truncated: boolean };

// Which card shows what. `net` is computed client-side from the summary; the rest
// fetch a slice from the detail endpoint (commissions are filtered per card).
type CardDef = {
  key: string;
  title: string;
  kind?: DetailKind;
  filter?: (r: CommissionRow) => boolean;
  note?: string;
};

const OWED = new Set(['pending', 'approved']);

const CARDS: Record<string, CardDef> = {
  net: { key: 'net', title: 'QuickSites net take — how it’s computed' },
  partners_owed: {
    key: 'partners_owed',
    title: 'Partners owed (unpaid residuals)',
    kind: 'commissions',
    filter: (r) => r.kind === 'residual' && OWED.has(r.status),
    note: 'Pending + approved partner residuals accrued against platform fees, not yet paid out.',
  },
  residual_paid: {
    key: 'residual_paid',
    title: 'Partner residuals paid',
    kind: 'commissions',
    filter: (r) => r.kind === 'residual' && r.status === 'paid',
  },
  hub_owed: {
    key: 'hub_owed',
    title: 'Hub overrides owed',
    kind: 'commissions',
    filter: (r) => r.kind === 'override' && OWED.has(r.status),
  },
  hub_paid: {
    key: 'hub_paid',
    title: 'Hub overrides paid',
    kind: 'commissions',
    filter: (r) => r.kind === 'override' && r.status === 'paid',
  },
  fees: {
    key: 'fees',
    title: 'Platform fees by order',
    kind: 'paid_orders',
    note: 'Gross platform fee locked at draft on each paid order.',
  },
  gmv: { key: 'gmv', title: 'Paid orders (GMV)', kind: 'paid_orders' },
  paid_orders: { key: 'paid_orders', title: 'Paid orders', kind: 'paid_orders' },
  refunded_orders: { key: 'refunded_orders', title: 'Refunded orders', kind: 'refunded_orders' },
  refunded_fees: {
    key: 'refunded_fees',
    title: 'Refunded orders — fees reversed',
    kind: 'refunded_orders',
    note: 'Fees on refunded orders are reversed on Stripe; they were already excluded from the gross above.',
  },
};

function Stat({
  label,
  value,
  highlight,
  active,
  onClick,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border p-4 text-left transition-colors hover:border-foreground/40 ${
        highlight ? 'bg-muted' : ''
      } ${active ? 'ring-2 ring-primary/60' : ''}`}
      aria-expanded={!!active}
      title="Click to see the breakdown"
    >
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span aria-hidden className={`transition-transform ${active ? 'rotate-90' : ''}`}>›</span>
      </div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </button>
  );
}

function OrdersTable({ rows, emphasizeFee }: { rows: OrderRow[]; emphasizeFee?: boolean }) {
  if (!rows.length) return <div className="py-4 text-sm text-muted-foreground">No orders in this window.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-normal">Date</th>
            <th className="py-1 pr-3 font-normal">Merchant</th>
            <th className="py-1 pr-3 font-normal">Site</th>
            <th className="py-1 pr-3 text-right font-normal">Total</th>
            <th className={`py-1 text-right font-normal ${emphasizeFee ? 'text-foreground' : ''}`}>Fee</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-1 pr-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
              <td className="py-1 pr-3">{r.merchant}</td>
              <td className="py-1 pr-3 text-muted-foreground">{r.site_slug}</td>
              <td className="py-1 pr-3 text-right tabular-nums">{fmt(r.total_cents)}</td>
              <td className={`py-1 text-right tabular-nums ${emphasizeFee ? 'font-medium' : ''}`}>
                {fmt(r.platform_fee_cents)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CommissionsTable({ rows }: { rows: CommissionRow[] }) {
  if (!rows.length) return <div className="py-4 text-sm text-muted-foreground">No ledger entries in this window.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="py-1 pr-3 font-normal">Date</th>
            <th className="py-1 pr-3 font-normal">Referral code</th>
            <th className="py-1 pr-3 font-normal">Type</th>
            <th className="py-1 pr-3 font-normal">Status</th>
            <th className="py-1 pr-3 font-normal">Order</th>
            <th className="py-1 text-right font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0">
              <td className="py-1 pr-3 whitespace-nowrap">{fmtDate(r.created_at)}</td>
              <td className="py-1 pr-3">{r.referral_code}</td>
              <td className="py-1 pr-3">{r.kind === 'override' ? 'hub override' : 'residual'}</td>
              <td className="py-1 pr-3 capitalize">{r.status}</td>
              <td className="py-1 pr-3 font-mono text-xs text-muted-foreground">{r.subject_id.slice(0, 8)}</td>
              <td className="py-1 text-right tabular-nums">{fmt(r.amount_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The net-take arithmetic, rendered from the already-loaded summary. */
function NetBreakdown({ data }: { data: any }) {
  const residual = data?.partner_residual_cents ?? { owed: 0, paid: 0, void: 0 };
  const override = data?.hub_override_cents ?? { owed: 0, paid: 0, void: 0 };
  const rows: { label: string; cents: number; sign: '+' | '−' }[] = [
    { label: 'Platform fees (gross, paid orders)', cents: data.platform_fee_cents, sign: '+' },
    { label: 'Partner residual owed', cents: residual.owed, sign: '−' },
    { label: 'Partner residual paid', cents: residual.paid, sign: '−' },
  ];
  if ((override.owed || 0) + (override.paid || 0) > 0) {
    rows.push({ label: 'Hub override owed', cents: override.owed, sign: '−' });
    rows.push({ label: 'Hub override paid', cents: override.paid, sign: '−' });
  }
  return (
    <div>
      <ul className="text-sm">
        {rows.map((r) => (
          <li key={r.label} className="flex justify-between border-b py-1">
            <span className="text-muted-foreground">{r.label}</span>
            <span className="tabular-nums">
              {r.sign === '−' ? '−' : ''}
              {fmt(r.cents)}
            </span>
          </li>
        ))}
        <li className="flex justify-between py-1 font-medium">
          <span>QuickSites net take</span>
          <span className="tabular-nums">{fmt(data.qs_net_cents)}</span>
        </li>
      </ul>
      {(residual.void || 0) + (override.void || 0) > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {fmt((residual.void || 0) + (override.void || 0))} in voided commissions (reversed on refund) is excluded
          from both sides.
        </p>
      )}
    </div>
  );
}

// ---- Page ----------------------------------------------------------------------

export default function RevenuePage() {
  const [data, setData] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [since, setSince] = React.useState('');
  const [checking, setChecking] = React.useState(false);

  // Drill-down state: which card is open + a per-kind fetch cache for the window.
  const [openCard, setOpenCard] = React.useState<string | null>(null);
  const [details, setDetails] = React.useState<Partial<Record<DetailKind, DetailPayload>>>({});
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);

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
      setDetails({}); // window changed — drop the drill-down cache
    } catch (e: any) {
      setError(e?.message || 'failed');
    } finally {
      setChecking(false);
    }
  }, [since]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const fetchDetail = React.useCallback(
    async (kind: DetailKind) => {
      if (details[kind]) return;
      setDetailLoading(true);
      setDetailError(null);
      try {
        const params = new URLSearchParams({ kind });
        if (since) params.set('since', since);
        const res = await fetch(`/api/admin/revenue/detail?${params}`, { cache: 'no-store' });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || `failed (${res.status})`);
        setDetails((d) => ({ ...d, [kind]: json }));
      } catch (e: any) {
        setDetailError(e?.message || 'failed');
      } finally {
        setDetailLoading(false);
      }
    },
    [details, since]
  );

  const toggleCard = (key: string) => {
    const next = openCard === key ? null : key;
    setOpenCard(next);
    const kind = next ? CARDS[next]?.kind : undefined;
    if (kind) void fetchDetail(kind);
  };

  const comm = data?.commission_ledger_cents ?? {};
  const residual = data?.partner_residual_cents ?? {};
  const override = data?.hub_override_cents ?? { owed: 0, paid: 0, void: 0 };
  const hasOverride = (override.owed || 0) + (override.paid || 0) > 0;
  const stripeRec = data?.stripe_reconciliation ?? null;

  const card = openCard ? CARDS[openCard] : null;
  const payload = card?.kind ? details[card.kind] : null;
  const commissionRows =
    card?.kind === 'commissions' && payload
      ? (payload.rows as CommissionRow[]).filter(card.filter ?? (() => true))
      : null;

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
            <Stat label="QuickSites net take" value={fmt(data.qs_net_cents)} highlight active={openCard === 'net'} onClick={() => toggleCard('net')} />
            <Stat label="Partners owed (unpaid)" value={fmt(residual.owed)} highlight active={openCard === 'partners_owed'} onClick={() => toggleCard('partners_owed')} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="Platform fees (gross)" value={fmt(data.platform_fee_cents)} active={openCard === 'fees'} onClick={() => toggleCard('fees')} />
            <Stat label="Partner residual paid" value={fmt(residual.paid)} active={openCard === 'residual_paid'} onClick={() => toggleCard('residual_paid')} />
            {hasOverride && <Stat label="Hub overrides (owed)" value={fmt(override.owed)} active={openCard === 'hub_owed'} onClick={() => toggleCard('hub_owed')} />}
            {hasOverride && <Stat label="Hub overrides (paid)" value={fmt(override.paid)} active={openCard === 'hub_paid'} onClick={() => toggleCard('hub_paid')} />}
            <Stat label="GMV (paid)" value={fmt(data.gmv_cents)} active={openCard === 'gmv'} onClick={() => toggleCard('gmv')} />
            <Stat label="Paid orders" value={String(data.orders.paid)} active={openCard === 'paid_orders'} onClick={() => toggleCard('paid_orders')} />
            <Stat label="Refunded orders" value={String(data.orders.refunded)} active={openCard === 'refunded_orders'} onClick={() => toggleCard('refunded_orders')} />
            <Stat label="Refunded fees" value={fmt(data.refunded_fee_cents)} active={openCard === 'refunded_fees'} onClick={() => toggleCard('refunded_fees')} />
          </div>

          {/* Drill-down panel for the open card. */}
          {card && (
            <div className="mt-4 rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">{card.title}</h2>
                <button
                  type="button"
                  onClick={() => setOpenCard(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Close ✕
                </button>
              </div>
              {card.note && <p className="mb-2 text-xs text-muted-foreground">{card.note}</p>}

              {openCard === 'net' && <NetBreakdown data={data} />}

              {card.kind && detailLoading && !payload && (
                <div className="py-4 text-sm text-muted-foreground">Loading…</div>
              )}
              {card.kind && detailError && !payload && (
                <div className="py-2 text-sm text-red-500">{detailError}</div>
              )}
              {card.kind && payload && (
                <>
                  {card.kind === 'commissions' ? (
                    <CommissionsTable rows={commissionRows ?? []} />
                  ) : (
                    <OrdersTable rows={payload.rows as OrderRow[]} emphasizeFee={openCard === 'fees' || openCard === 'refunded_fees'} />
                  )}
                  {payload.truncated && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Showing the {payload.rows.length} most recent of {payload.total} rows — narrow the window with
                      “Since” to see the rest.
                    </p>
                  )}
                </>
              )}
            </div>
          )}

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
