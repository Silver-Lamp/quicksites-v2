// app/admin/demand-funnel/page.tsx
// The kickoff cockpit: the no-website demand funnel in one screen — imported drafts →
// demand → claimed → onboarded → taking orders, plus the money KPIs and the hottest
// drafts to push. Admin-gated server component. See lib/menu/demandFunnel.ts.
import Link from 'next/link';
import { getAdminUser } from '@/lib/auth/getAdminUser';
import { loadDemandFunnel } from '@/lib/menu/demandFunnel';
import { menuSiteUrl } from '@/lib/menu/deliveredMenu';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function fmtMoney(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—';
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/40 p-4">
      <div className={`text-2xl font-bold tabular-nums ${accent ?? 'text-white'}`}>{value}</div>
      <div className="mt-1 text-xs text-neutral-400">{label}</div>
    </div>
  );
}

export default async function DemandFunnelPage() {
  const admin = await getAdminUser();
  if (!admin) return <div className="p-8 text-neutral-400">Forbidden.</div>;

  const f = await loadDemandFunnel();
  const top = f.stages[0]?.count || 0; // funnel base — bar widths are relative to this
  const avgFee = f.paidOrders ? f.feesCollectedCents / f.paidOrders : 0;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 text-white">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Demand funnel</h1>
          <p className="mt-1 text-sm text-neutral-400">
            The no-website cohort, imported drafts → paying restaurants. One screen to watch it convert.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 text-sm">
          <Link href="/admin/go-live" className="text-emerald-400 underline underline-offset-4 hover:text-emerald-300">
            Go-live readiness →
          </Link>
          <Link href="/admin/outreach" className="text-sky-400 underline underline-offset-4 hover:text-sky-300">
            Outreach pipeline →
          </Link>
        </div>
      </div>

      {/* --- The funnel (single-hue magnitude; every value direct-labeled) --- */}
      <div className="mt-8 space-y-2.5">
        {f.stages.map((s, i) => {
          const prev = i > 0 ? f.stages[i - 1].count : 0;
          const conv = i > 0 && prev > 0 ? Math.round((s.count / prev) * 100) : null;
          const pct = top > 0 ? (s.count / top) * 100 : 0;
          const width = s.count > 0 ? Math.max(pct, 3) : 0; // keep a non-zero count visible
          return (
            <div key={s.key} className="flex items-center gap-3">
              <div className="w-40 shrink-0 text-right text-sm text-neutral-300">{s.label}</div>
              <div className="relative h-8 flex-1 overflow-hidden rounded-lg bg-neutral-800/40">
                <div
                  className="flex h-full items-center rounded-lg bg-sky-500/80 pl-3 text-sm font-semibold text-neutral-950"
                  style={{ width: `${width}%`, minWidth: s.count > 0 ? '2.5rem' : 0 }}
                >
                  {s.count > 0 ? s.count : ''}
                </div>
                {s.count === 0 && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-neutral-600">0</span>}
              </div>
              <div className="w-16 shrink-0 text-xs tabular-nums text-neutral-500">
                {conv !== null ? `${conv}%` : ''}
              </div>
            </div>
          );
        })}
        <p className="pl-[10.75rem] pt-1 text-[11px] text-neutral-600">Bar width ∝ share of drafts built · right column = conversion from the prior stage.</p>
      </div>

      {/* --- Money + intent KPIs --- */}
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Order intents logged" value={String(f.orderIntents)} accent="text-sky-300" />
        <Kpi label="Reachable leads" value={String(f.leads)} accent="text-sky-300" />
        <Kpi label="Paid orders" value={String(f.paidOrders)} accent="text-emerald-300" />
        <Kpi label="Fees collected" value={fmtMoney(f.feesCollectedCents)} accent="text-emerald-300" />
      </div>
      {f.paidOrders > 0 && (
        <p className="mt-2 text-xs text-neutral-500">Avg platform fee / order: {fmtMoney(avgFee)}</p>
      )}

      {/* --- Hottest drafts (push these) + recent intents --- */}
      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold text-neutral-200">🔥 Hottest drafts — push these</h2>
          <div className="mt-3 space-y-2">
            {f.hottest.length === 0 && <p className="text-sm text-neutral-500">No demand logged yet. Place order QRs / index drafts to feed it.</p>}
            {f.hottest.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{h.name}</div>
                  <div className="text-xs text-neutral-500">
                    🔥 {h.demand} intent{h.demand === 1 ? '' : 's'}{h.leads > 0 ? ` · ${h.leads} lead${h.leads === 1 ? '' : 's'}` : ''}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {h.claimed
                    ? <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">Claimed</span>
                    : <span className="rounded bg-amber-500/20 px-2 py-0.5 text-xs text-amber-300">Unclaimed</span>}
                  <a href={menuSiteUrl(h.slug ?? h.id)} target="_blank" rel="noopener noreferrer" className="text-xs text-sky-400 underline underline-offset-2 hover:text-sky-300">View ↗</a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-sm font-semibold text-neutral-200">Recent order intents</h2>
          <div className="mt-3 space-y-2">
            {f.recent.length === 0 && <p className="text-sm text-neutral-500">Nothing yet.</p>}
            {f.recent.map((r, i) => (
              <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900/40 px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-medium">{r.name}</span>
                  {r.items && <span className="text-neutral-400"> — “{r.items}”</span>}
                </div>
                <span className="shrink-0 text-xs text-neutral-500">{fmtDate(r.at)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
