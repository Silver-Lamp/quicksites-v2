// lib/tradeSites/planQueue.ts
//
// Load what the planner needs from the database, plan, and (optionally) write the plan into
// trade_sweep_queue in ranked order — highest priority first, so the cron takes the best pair
// tonight and the rest follow one a night.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { resolveSweepCategory } from '@/lib/prospects/sweepCategories';
import { planSweepQueue, type OwnedCampaign, type SweepHistory, type PlannedSweep } from './queuePlanner';
import { enqueueSweeps, listQueue } from './pipeline';

const db = () => supabaseAdmin as any;

export async function loadPlannerInputs(): Promise<{ campaigns: OwnedCampaign[]; history: SweepHistory[] }> {
  const [{ data: camps }, { data: prospects }] = await Promise.all([
    db().from('geo_industry_campaigns').select('city, region, industry_key, domain, rank_status, domain_status').not('domain', 'is', null).limit(2000),
    db().from('outreach_prospects').select('city, region, industry_key, lead_tier, created_at').limit(20000),
  ]);
  const agg = new Map<string, SweepHistory>();
  for (const p of prospects ?? []) {
    if (!p.city || !p.region || !p.industry_key) continue;
    const k = `${p.city}|${p.region}|${p.industry_key}`.toLowerCase();
    const a = agg.get(k) ?? { city: p.city, region: p.region, industry_key: p.industry_key, total: 0, noWebsite: 0, lastSweptAt: null };
    a.total++;
    if (p.lead_tier === 'no_website') a.noWebsite++;
    if (!a.lastSweptAt || p.created_at > a.lastSweptAt) a.lastSweptAt = p.created_at;
    agg.set(k, a);
  }
  return { campaigns: (camps ?? []) as OwnedCampaign[], history: [...agg.values()] };
}

export async function planTradeQueue(opts: { limit?: number; cooldownDays?: number } = {}) {
  const [{ campaigns, history }, queue] = await Promise.all([loadPlannerInputs(), listQueue(500)]);
  const alreadyQueued = queue.filter((r) => r.status === 'queued' || r.status === 'running').map((r) => ({ city: r.city, region: r.region, category: r.category }));
  return planSweepQueue({
    campaigns,
    history,
    alreadyQueued,
    categoryFor: (industry) => resolveSweepCategory(industry)?.label ?? null,
    limit: opts.limit,
    cooldownDays: opts.cooldownDays,
  });
}

/** Write a plan into the queue, ranked: priority descends with rank so the cron drains it in order. */
export async function enqueuePlan(plan: PlannedSweep[], requestedBy: string | null) {
  return enqueueSweeps(
    plan.map((p, i) => ({ city: p.city, region: p.region, category: p.category, priority: plan.length - i })),
    requestedBy,
  );
}
