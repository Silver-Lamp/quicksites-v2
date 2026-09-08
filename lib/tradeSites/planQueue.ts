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

export type PlanRowInput = Pick<PlannedSweep, 'city' | 'region' | 'category'>;

/**
 * Priorities for a plan that must run AFTER everything already queued, in the plan's own order.
 *
 * ⚠️ The first version numbered a plan `length..1` — the same range the previous plan used — so a
 * second plan interleaved with the first: Arlington HVAC (14) would have run tonight ahead of the
 * Braintree Towing (13) the operator had already put first, and every later night alternated
 * between the two lists. A click labelled "Queue these" must not reshuffle rows a person already
 * ordered; if the new plan should go first, cancel the old one. So a new plan starts one below the
 * lowest queued priority and descends from there (negative is fine — the drain orders by priority
 * desc, then oldest).
 */
export function prioritiesBehind(queuedPriorities: number[], count: number): number[] {
  const floor = queuedPriorities.length ? Math.min(...queuedPriorities) : 1;
  return Array.from({ length: count }, (_, i) => floor - 1 - i);
}

const pairKey = (r: { city: string; region: string; category: string }) => `${r.city}|${r.region}|${r.category}`.toLowerCase().trim();

/**
 * Write a plan (or the subset of it the operator ticked) into the queue, BEHIND what is already
 * queued and in the given order. Pairs already queued or running are skipped, not duplicated — the
 * same city × trade twice in one night's queue is two Places bills for one answer.
 */
export async function enqueuePlan(rows: PlanRowInput[], requestedBy: string | null) {
  const queue = (await listQueue(500)).filter((r) => r.status === 'queued' || r.status === 'running');
  const queuedKeys = new Set(queue.map(pairKey));
  const fresh = rows.filter((r) => !queuedKeys.has(pairKey(r)));
  const skippedQueued = rows.length - fresh.length;
  const priorities = prioritiesBehind(queue.map((r) => r.priority), fresh.length);
  const result = await enqueueSweeps(
    fresh.map((p, i) => ({ city: p.city, region: p.region, category: p.category, priority: priorities[i] })),
    requestedBy,
  );
  return { ...result, skippedQueued, queuedAhead: queue.length };
}
