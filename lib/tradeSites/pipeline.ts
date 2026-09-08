// lib/tradeSites/pipeline.ts
//
// The nightly trade-site pipeline: drain the sweep queue, then build a draft for every
// no-website trade business that has none. Runs from /api/cron/trade-site-pipeline; the same
// function answers an admin's "run now".
//
// Two spends, two caps. A sweep costs Places API calls (cents) — `maxSweeps` per run. A build
// costs one metered LLM copy pass (cents) — `maxBuilds` per run. Both are env-tunable and both
// default small, because the cron runs every night and a runaway is a bill, not a bug report.
//
// ⚠️ A person still chooses the cities. That is deliberate (docs/AUTO_SHOP_VERTICAL.md: "do not
// sweep more cities before the first messages report"). The queue is where they say so; the cron
// never invents a city.
import { supabaseAdmin } from '@/lib/supabase/admin';
import { runSweep } from '@/lib/prospects/runSweep';
import { resolveSweepCategory, sweepArgsFor, type SweepCategory } from '@/lib/prospects/sweepCategories';
import { buildDraftFromListing, BuildDraftError } from '@/lib/outreach/buildDraftFromListing';
import { listingForProspect } from '@/lib/outreach/listingForProspect';
import { markProspectBuilt, type Prospect } from '@/lib/outreach/prospects';
import { selectMailableDrafts, sendClaimPostcards, type SendReport } from '@/lib/outreach/claimPostcardSend';
import { isTradeIndustry } from './config';

const db = () => supabaseAdmin as any;

export type SweepQueueRow = {
  id: string;
  city: string;
  region: string;
  category: string;
  radius_meters: number;
  priority: number;
  status: 'queued' | 'running' | 'done' | 'failed' | 'cancelled';
  requested_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  result: Record<string, unknown> | null;
  error: string | null;
};

export type PipelineOptions = {
  maxSweeps?: number;
  maxBuilds?: number;
  /** Overrides every other operator resolution — used by an admin's manual run. */
  operatorId?: string | null;
};

export type PipelineReport = {
  sweeps: Array<{ id: string; city: string; region: string; category: string; ok: boolean; found?: number; noWebsite?: number; inserted?: number; error?: string }>;
  builds: { attempted: number; built: number; skipped: number; failed: number; results: Array<{ prospectId: string; ok: boolean; templateId?: string; slug?: string; error?: string }> };
  /** The claim-postcard step: null when TRADE_PIPELINE_MAIL_ENABLED is off. */
  mail: (SendReport & { candidates: number }) | null;
  operatorId: string | null;
  caps: { maxSweeps: number; maxBuilds: number };
};

export function mailEnabled(): boolean {
  const v = process.env.TRADE_PIPELINE_MAIL_ENABLED;
  return v === '1' || v === 'true';
}

/**
 * Postage caps. `minAgeHours` is the review window: a draft is never mailed the night it was
 * built, so an operator has one working day to look at last night's builds before a card goes
 * out under a real business's name.
 */
export function mailCaps(): { enabled: boolean; maxMail: number; minAgeHours: number } {
  const age = Number(process.env.TRADE_PIPELINE_MAIL_MIN_AGE_HOURS);
  return {
    enabled: mailEnabled(),
    maxMail: envInt('TRADE_PIPELINE_MAX_MAIL', 10, 25),
    minAgeHours: Number.isFinite(age) && age >= 0 ? age : 24,
  };
}

export function pipelineEnabled(): boolean {
  const v = process.env.TRADE_PIPELINE_ENABLED;
  return v === '1' || v === 'true';
}

function envInt(name: string, fallback: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= 0 ? Math.min(Math.floor(n), max) : fallback;
}

/** Caps from env, bounded so a typo cannot turn a nightly run into a fleet. */
export function pipelineCaps(): { maxSweeps: number; maxBuilds: number } {
  return {
    maxSweeps: envInt('TRADE_PIPELINE_MAX_SWEEPS', 1, 10),
    maxBuilds: envInt('TRADE_PIPELINE_MAX_BUILDS', 15, 50),
  };
}

/**
 * Whose drafts these are until the business claims them. Order: an explicit override, the env
 * operator, the queue row's requester, the prospect's discoverer, and finally the first platform
 * admin — never null, because a draft with no owner is invisible to every admin list.
 */
export async function resolveOperatorId(candidates: Array<string | null | undefined>): Promise<string | null> {
  for (const c of [process.env.TRADE_PIPELINE_OPERATOR_ID, ...candidates]) if (c) return c;
  const { data } = await db().from('admin_users').select('user_id').order('created_at', { ascending: true }).limit(1).maybeSingle();
  return (data as any)?.user_id ?? null;
}

/** Pure: the order rows are drained in. Higher priority first, then oldest first. */
export function orderQueue<T extends { priority: number; created_at: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.priority - a.priority || a.created_at.localeCompare(b.created_at));
}

/** Pure: which parked prospects the pipeline builds — no website, no draft, a trade, not dismissed. */
export function isBuildable(p: Pick<Prospect, 'status' | 'lead_tier' | 'template_id' | 'industry_key'>): boolean {
  return p.status === 'discovered' && p.lead_tier === 'no_website' && !p.template_id && isTradeIndustry(p.industry_key);
}

// ── Queue ops ────────────────────────────────────────────────────────────────────────────────

export async function listQueue(limit = 100): Promise<SweepQueueRow[]> {
  const { data, error } = await db().from('trade_sweep_queue').select('*').order('created_at', { ascending: false }).limit(limit);
  if (error) throw new Error(`trade_sweep_queue list: ${error.message}`);
  return (data ?? []) as SweepQueueRow[];
}

export async function enqueueSweeps(
  rows: Array<{ city: string; region: string; category: string; radiusMeters?: number; priority?: number }>,
  requestedBy: string | null,
): Promise<{ inserted: number; rejected: Array<{ city: string; category: string; reason: string }> }> {
  const rejected: Array<{ city: string; category: string; reason: string }> = [];
  const ok: Record<string, unknown>[] = [];
  for (const r of rows) {
    const city = String(r.city ?? '').trim();
    const region = String(r.region ?? '').trim();
    const cat = resolveSweepCategory(r.category);
    if (!city || !region) { rejected.push({ city, category: r.category, reason: 'city and region are required' }); continue; }
    if (!cat) { rejected.push({ city, category: r.category, reason: 'unknown category' }); continue; }
    if (cat.label === 'Restaurants') { rejected.push({ city, category: r.category, reason: 'restaurants are not a trade — use the restaurant pipeline' }); continue; }
    ok.push({
      city, region, category: cat.label,
      radius_meters: Math.min(Math.max(Number(r.radiusMeters) || 1500, 300), 50000),
      priority: Number.isFinite(Number(r.priority)) ? Number(r.priority) : 0,
      requested_by: requestedBy,
    });
  }
  if (ok.length) {
    const { error } = await db().from('trade_sweep_queue').insert(ok);
    if (error) throw new Error(`trade_sweep_queue insert: ${error.message}`);
  }
  return { inserted: ok.length, rejected };
}

export async function cancelQueued(id: string): Promise<boolean> {
  const { data, error } = await db().from('trade_sweep_queue').update({ status: 'cancelled', finished_at: new Date().toISOString() }).eq('id', id).eq('status', 'queued').select('id');
  if (error) throw new Error(`trade_sweep_queue cancel: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

// ── The run ──────────────────────────────────────────────────────────────────────────────────

async function drainSweeps(max: number, override: string | null | undefined, report: PipelineReport) {
  if (max <= 0) return;
  const { data } = await db().from('trade_sweep_queue').select('*').eq('status', 'queued').limit(200);
  const queued = orderQueue((data ?? []) as SweepQueueRow[]).slice(0, max);
  for (const row of queued) {
    await db().from('trade_sweep_queue').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', row.id);
    const entry: PipelineReport['sweeps'][number] = { id: row.id, city: row.city, region: row.region, category: row.category, ok: false };
    try {
      const cat = resolveSweepCategory(row.category) as SweepCategory | null;
      if (!cat) throw new Error(`unknown category ${row.category}`);
      const operatorId = override ?? (await resolveOperatorId([row.requested_by]));
      const r = await runSweep({ city: row.city, region: row.region, radiusMeters: row.radius_meters, ...sweepArgsFor([cat]), operatorId });
      entry.ok = true;
      entry.found = r.found;
      entry.inserted = r.inserted;
      entry.noWebsite = r.tallies.no_website ?? 0;
      await db().from('trade_sweep_queue').update({
        status: 'done', finished_at: new Date().toISOString(),
        result: { sweepId: r.sweepId, found: r.found, inserted: r.inserted, tallies: r.tallies },
      }).eq('id', row.id);
    } catch (e) {
      entry.error = (e as any)?.message || String(e);
      await db().from('trade_sweep_queue').update({ status: 'failed', finished_at: new Date().toISOString(), error: entry.error }).eq('id', row.id);
    }
    report.sweeps.push(entry);
  }
}

async function buildDrafts(max: number, override: string | null | undefined, report: PipelineReport) {
  if (max <= 0) return;
  // Newest first: tonight's sweep gets built tonight, and the backlog (e.g. the 31 prospects whose
  // invented-claim drafts were deleted) drains behind it at `max` a night.
  const { data } = await db()
    .from('outreach_prospects')
    .select('id, created_at, place_id, business_name, phone, address, address_lat, address_lon, city, region, industry_key, categories, website, freshness_score, freshness_signals, lead_tier, status, template_id, geo_campaign_id, waitlist_status, sweep_id, rating, review_count, discovered_by')
    .eq('status', 'discovered')
    .eq('lead_tier', 'no_website')
    .is('template_id', null)
    .not('industry_key', 'is', null)
    .neq('industry_key', 'restaurant')
    .order('created_at', { ascending: false })
    .limit(max * 3);
  const candidates = ((data ?? []) as Array<Prospect & { discovered_by?: string | null }>).filter(isBuildable).slice(0, max);

  for (const p of candidates) {
    report.builds.attempted++;
    try {
      const operatorId = override ?? (await resolveOperatorId([p.discovered_by]));
      if (!operatorId) throw new Error('no operator id to own the draft');
      const listing = await listingForProspect(p);
      // ⚠️ Pass the prospect's own industry. Omitting it lets the guess default to 'restaurant',
      // which has put a menu block and an order bar under a real tow company's name twice.
      const built = await buildDraftFromListing({ listing, operatorId, industryKey: (p.industry_key as any) || undefined });
      await markProspectBuilt(p.id, built.id);
      report.builds.built++;
      report.builds.results.push({ prospectId: p.id, ok: true, templateId: built.id, slug: built.slug });
    } catch (e) {
      report.builds.failed++;
      report.builds.results.push({ prospectId: p.id, ok: false, error: e instanceof BuildDraftError ? e.message : (e as any)?.message || 'build_failed' });
    }
  }
}

export async function runTradePipeline(opts: PipelineOptions = {}): Promise<PipelineReport> {
  const caps = pipelineCaps();
  const maxSweeps = opts.maxSweeps ?? caps.maxSweeps;
  const maxBuilds = opts.maxBuilds ?? caps.maxBuilds;
  const report: PipelineReport = {
    sweeps: [],
    builds: { attempted: 0, built: 0, skipped: 0, failed: 0, results: [] },
    mail: null,
    operatorId: opts.operatorId ?? process.env.TRADE_PIPELINE_OPERATOR_ID ?? null,
    caps: { maxSweeps, maxBuilds },
  };
  await drainSweeps(maxSweeps, opts.operatorId, report);
  await buildDrafts(maxBuilds, opts.operatorId, report);
  await mailClaimPostcards(opts.operatorId ?? null, report);
  return report;
}

/**
 * The third step: mail a claim postcard to every built, reviewed, unmailed trade draft, at
 * `maxMail` a night. Gated twice — TRADE_PIPELINE_MAIL_ENABLED here, and POSTCARD_MAIL_ENABLED +
 * LOB_* inside sendClaimPostcards — because this is the step that spends postage on a stranger.
 * A draft with an operational claim is blocked at send, never mailed, and counted.
 */
async function mailClaimPostcards(sentBy: string | null, report: PipelineReport) {
  const caps = mailCaps();
  if (!caps.enabled || caps.maxMail <= 0) return;
  const drafts = await selectMailableDrafts({ minAgeHours: caps.minAgeHours, limit: 100 });
  const sent = await sendClaimPostcards({ drafts, sentBy, max: caps.maxMail });
  report.mail = { ...sent, candidates: drafts.length };
}
