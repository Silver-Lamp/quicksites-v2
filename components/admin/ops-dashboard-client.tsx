'use client';

// components/admin/ops-dashboard-client.tsx
//
// The one-screen operations dashboard: gauges + KPIs for the health of inventory,
// markets, and clients, plus a prioritized "next steps" worklist (a holistic top-5
// and a top-5 per category). Server data arrives as props; live Google rank is
// fetched here (needs per-domain OAuth) and folded into the ranked-but-not-rented
// signal — that's what surfaces a pre-reboot page-1 domain as a postcard-challenge
// opportunity.

import { useEffect, useMemo, useState } from 'react';
import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import { buildRankedOpportunities, type GscStat } from '@/lib/prospects/rankedOpportunities';
import { buildOpsSignals, computeOpsNextSteps, type OpsStep, type OpsCategory } from '@/lib/ops/nextSteps';
import type { OpsSnapshot } from '@/lib/ops/opsSnapshotServer';
import DomainSpendChart from '@/components/admin/domain-spend-chart';
import RevenueSimulator from '@/components/admin/ops/revenue-simulator';
import { KpiTile, Gauge, SegmentBar, SeverityTag, formatMoney, type Tone } from '@/components/admin/ops/ops-widgets';
import SuperAdminSetupAlerts from '@/components/admin/super-admin-setup-alerts';

/** Count no-website competition clusters (city×industry, ≥2) with no live campaign. */
function countOpenCompetition(prospects: OpsSnapshot['markets']['prospects'], campaigns: OpsSnapshot['markets']['campaigns']): number {
  const live = new Set(
    campaigns
      .filter((c) => c.city && c.industry_key && c.status !== 'archived')
      .map((c) => `${c.city.trim().toLowerCase()}::${c.industry_key}`),
  );
  const groups = new Map<string, number>();
  for (const p of prospects) {
    if (p.lead_tier !== 'no_website' || p.status !== 'discovered') continue;
    if (!p.city || !p.industry_key || p.industry_key === 'other') continue;
    const key = `${p.city.toLowerCase()}::${p.industry_key}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let open = 0;
  for (const [key, count] of groups) if (count >= 2 && !live.has(key)) open += 1;
  return open;
}

function ratioTone(frac: number): Tone {
  if (frac >= 0.5) return 'good';
  if (frac >= 0.25) return 'warn';
  return 'bad';
}

function NextStep({ s }: { s: OpsStep }) {
  const inner = (
    <div className="flex items-start gap-3">
      <SeverityTag severity={s.severity} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-neutral-100">{s.title}</div>
        <div className="mt-0.5 text-xs text-neutral-400">{s.detail}</div>
      </div>
      {s.href ? (
        <span className="shrink-0 self-center rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs font-medium text-sky-200 group-hover:bg-sky-500/20">
          {s.cta ?? 'Open'} →
        </span>
      ) : null}
    </div>
  );
  return s.href ? (
    <a href={s.href} className="group block rounded-xl border border-zinc-800 bg-zinc-900/40 p-3 transition hover:border-zinc-600">
      {inner}
    </a>
  ) : (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">{inner}</div>
  );
}

const CATEGORY_META: Record<OpsCategory, { label: string; emoji: string }> = {
  inventory: { label: 'Inventory', emoji: '🌐' },
  markets: { label: 'Markets', emoji: '📍' },
  clients: { label: 'Clients', emoji: '👥' },
};

export default function OpsDashboardClient({ snapshot }: { snapshot: OpsSnapshot }) {
  const { inventory, revenue, clients, markets } = snapshot;

  const [gscByDomain, setGscByDomain] = useState<Record<string, GscStat> | undefined>(undefined);
  const [gscLoaded, setGscLoaded] = useState(false);
  useEffect(() => {
    let alive = true;
    fetch('/api/gsc/summary')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return;
        if (j?.ok && j.byDomain) setGscByDomain(j.byDomain);
        setGscLoaded(true);
      })
      .catch(() => alive && setGscLoaded(true));
    return () => { alive = false; };
  }, []);

  const rankedOpportunities = useMemo(
    () => buildRankedOpportunities(markets.campaigns, markets.prospects, gscByDomain),
    [markets.campaigns, markets.prospects, gscByDomain],
  );

  const openCompetition = useMemo(() => countOpenCompetition(markets.prospects, markets.campaigns), [markets.prospects, markets.campaigns]);

  const nextSteps = useMemo(() => {
    const signals = buildOpsSignals({
      inventory: { domains: inventory.domains, rollup: inventory.rollup },
      gscByDomain,
      campaigns: markets.campaigns,
      prospects: markets.prospects,
      rankedOpportunities,
      clients: {
        activeSubscribers: clients.activeSubscribers,
        mrrCents: clients.mrrCents,
        customers: clients.customers,
        repeatBuyers: clients.repeatBuyers,
        lapsedCustomers: clients.lapsedCustomers,
      },
      channels: { mail: markets.channels.mail, sms: markets.channels.sms },
      openCompetitionGroups: openCompetition,
      nowMs: Date.now(),
    });
    return computeOpsNextSteps(signals);
  }, [inventory, markets, clients, rankedOpportunities, gscByDomain, openCompetition]);

  const roll = inventory.rollup;
  const working = roll.rentedCount + roll.rankingCount;
  const refinedCampaigns = markets.campaigns.filter((c) => c.outreach_ready_at).length;
  const page1Count = useMemo(() => {
    if (!gscByDomain) return 0;
    let n = 0;
    for (const s of Object.values(gscByDomain)) if (s.position > 0 && s.position <= 10) n += 1;
    return n;
  }, [gscByDomain]);

  const netTake = revenue.qs_net_cents;
  const netBurn = roll.netMonthlyCents;

  return (
    <div className="text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Operations</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Health of inventory, markets, and clients — with the highest-leverage next moves surfaced first.
          </p>
        </div>
        <div className="text-xs text-neutral-500">
          {gscLoaded ? (page1Count > 0 ? `${page1Count} domain${page1Count === 1 ? '' : 's'} on Google page 1` : 'Rank synced') : 'Loading live rank…'}
        </div>
      </div>

      {/* One-time super-admin setup actions (seed demos/starters) — self-hides when done. */}
      <div className="mt-6">
        <SuperAdminSetupAlerts />
      </div>

      {/* Headline KPIs */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiTile label="Net platform take" value={formatMoney(netTake)} tone={netTake >= 0 ? 'good' : 'bad'} sub={`${formatMoney(revenue.gmv_cents)} GMV · ${revenue.orders.paid} paid`} href="/admin/revenue" />
        <KpiTile label="MRR (subscriptions)" value={formatMoney(clients.mrrCents)} tone={clients.mrrCents > 0 ? 'good' : 'neutral'} sub={`${clients.activeSubscribers} active plan${clients.activeSubscribers === 1 ? '' : 's'}`} href="/admin/billing/map" />
        <KpiTile label="Domain net burn / mo" value={formatMoney(netBurn)} tone={netBurn > 0 ? 'bad' : 'good'} sub={`${roll.count} owned · ${roll.idleCount} idle`} href="/admin/domains/costs" />
        <KpiTile label="Live campaigns" value={markets.campaigns.length} tone="info" sub={`${refinedCampaigns} refined · ${openCompetition} to grab`} href="/admin/growth?tab=prospects" />
        <KpiTile label="Customers" value={clients.customers.toLocaleString()} tone="info" sub={`${clients.repeatBuyers} repeat · ${formatMoney(clients.totalLtvCents)} LTV`} />
      </div>

      {/* Gauges */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        <Gauge label="Domains working" value={working} max={roll.count || 1} tone={ratioTone(roll.count ? working / roll.count : 0)} caption={`${working} of ${roll.count} rented or ranking`} />
        <Gauge label="Sites refined" value={refinedCampaigns} max={markets.campaigns.length || 1} tone={ratioTone(markets.campaigns.length ? refinedCampaigns / markets.campaigns.length : 0)} caption={`${refinedCampaigns} of ${markets.campaigns.length} ready to mail`} />
        <Gauge label="Repeat rate" value={clients.repeatBuyers} max={clients.customers || 1} tone={ratioTone(clients.customers ? clients.repeatBuyers / clients.customers : 0)} caption={`${clients.repeatBuyers} of ${clients.customers} buyers`} />
        <SegmentBar
          title="Domain mix"
          segments={[
            { label: 'Rented', value: roll.rentedCount, tone: 'good' },
            { label: 'Ranking', value: roll.rankingCount, tone: 'warn' },
            { label: 'Idle', value: roll.idleCount, tone: 'bad' },
          ]}
        />
      </div>

      {/* Holistic Top 5 */}
      <div className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Top 5 next steps</h2>
        <p className="mt-1 text-xs text-neutral-500">The highest-leverage moves across every part of the operation, ranked.</p>
        <div className="mt-3 space-y-2">
          {nextSteps.top.length ? (
            nextSteps.top.map((s) => <NextStep key={s.id} s={s} />)
          ) : (
            <div className="rounded-xl border border-dashed border-zinc-800 px-4 py-8 text-center text-sm text-neutral-500">
              {gscLoaded ? 'Nothing urgent — everything monetized and refined. Sweep a new city to grow.' : 'Loading signals…'}
            </div>
          )}
        </div>
      </div>

      {/* Revenue simulator */}
      <div className="mt-8">
        <RevenueSimulator source={{ rollup: inventory.rollup, revenue, clients }} />
      </div>

      {/* Spend projection */}
      <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="mb-1 text-sm font-semibold text-neutral-200">Domain spend — next 12 months</div>
        <p className="mb-3 text-xs text-neutral-500">Cumulative renewal liability (amber) vs. net of the rent you already collect (emerald).</p>
        <DomainSpendChart points={inventory.projection} />
      </div>

      {/* Per-category top 5s */}
      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {(['inventory', 'markets', 'clients'] as OpsCategory[]).map((cat) => (
          <div key={cat}>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-neutral-200">
              <span>{CATEGORY_META[cat].emoji}</span>
              {CATEGORY_META[cat].label}
              <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium text-neutral-400">{nextSteps.byCategory[cat].length}</span>
            </h3>
            <div className="mt-2 space-y-2">
              {nextSteps.byCategory[cat].length ? (
                nextSteps.byCategory[cat].map((s) => <NextStep key={s.id} s={s} />)
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-800 px-3 py-6 text-center text-xs text-neutral-600">All clear</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {inventory.vercelUnavailable && (
        <div className="mt-6 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-300/90">
          Couldn't reach Vercel — the domain list may be missing account-only domains and expiry dates.
        </div>
      )}
    </div>
  );
}
