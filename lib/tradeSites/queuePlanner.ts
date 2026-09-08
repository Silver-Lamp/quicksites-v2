// lib/tradeSites/queuePlanner.ts
//
// Decide which city × trade the nightly pipeline should sweep next, from what we already know.
// Pure: the loader in ./planQueue.ts feeds it rows, the tests feed it fixtures.
//
// Two facts drive the ranking, both measured rather than guessed:
//
//   1. WHERE WE OWN THE DOMAIN. A draft built in a city where we hold <city>-<trade>.com is worth
//      more than one anywhere else — the pitch site and the claim card reinforce each other, and
//      the handoff of 2026-09-07 said it plainly: "sweep a city where you own the domain AND have
//      ten-plus local no-website businesses before spending on print."
//   2. HOW OFTEN A TRADE HAS NO WEBSITE. docs/AUTO_SHOP_VERTICAL.md found the rate is a property of
//      the trade, not the city — auto repair 57–66% in urban NJ, towing ~50%, plumbing ~25%,
//      roofing 3% and fencing 0–6% (trades found by search all have sites). Where we have swept a
//      trade at least ten times, the measured rate replaces the prior.
//
// A pair swept inside the cooldown is skipped: a re-sweep dedupes on place_id and finds nothing
// new. A pair that measured under 10% no-website is pushed down, not out — the prior may be wrong.
// Restaurants are never planned: they belong to the take-rate pipeline.

export type OwnedCampaign = { city: string; region: string; industry_key: string | null; domain: string; rank_status?: string | null };
export type SweepHistory = { city: string; region: string; industry_key: string | null; total: number; noWebsite: number; lastSweptAt: string | null };
export type QueuedPair = { city: string; region: string; category: string };

export type PlannedSweep = {
  city: string;
  region: string;
  industry: string;
  category: string;
  priority: number;
  reasons: string[];
};

/** Prior no-website rate per trade, from docs/AUTO_SHOP_VERTICAL.md and the July/September sweeps. */
export const NO_WEBSITE_PRIOR: Record<string, number> = {
  auto_repair: 0.5,
  towing: 0.45,
  windshield_repair: 0.35,
  junk_removal: 0.35,
  concrete: 0.3,
  pressure_washing: 0.3,
  roof_cleaning: 0.25,
  plumbing: 0.25,
  hvac: 0.25,
  landscaping: 0.25,
  general_contractor: 0.2,
  electrical: 0.2,
  painting: 0.2,
  moving: 0.2,
  pest_control: 0.15,
  siding: 0.1,
  paving: 0.1,
  fencing: 0.05,
  roofing: 0.03,
};

const NEVER = new Set(['restaurant', 'personal', 'author', 'faith', 'lemonade_stand']);

const norm = (s: string | null | undefined) => String(s ?? '').trim().toLowerCase();
const pairKey = (city: string, region: string, industry: string) => `${norm(city)}|${norm(region)}|${norm(industry)}`;

/** Measured rate per trade across every sweep with enough businesses to mean something. */
export function measuredRates(history: SweepHistory[], minTotal = 10): Record<string, { rate: number; total: number }> {
  const acc: Record<string, { nw: number; total: number }> = {};
  for (const h of history) {
    if (!h.industry_key) continue;
    const a = (acc[h.industry_key] ??= { nw: 0, total: 0 });
    a.nw += h.noWebsite;
    a.total += h.total;
  }
  const out: Record<string, { rate: number; total: number }> = {};
  for (const [k, a] of Object.entries(acc)) if (a.total >= minTotal) out[k] = { rate: a.nw / a.total, total: a.total };
  return out;
}

export function planSweepQueue(input: {
  campaigns: OwnedCampaign[];
  history: SweepHistory[];
  alreadyQueued: QueuedPair[];
  /** industry_key → category label the sweep understands; pairs with no category are dropped with a reason. */
  categoryFor: (industry: string) => string | null;
  limit?: number;
  cooldownDays?: number;
  now?: Date;
}): { plan: PlannedSweep[]; skipped: Array<{ city: string; region: string; industry: string; why: string }> } {
  const now = input.now ?? new Date();
  const cooldownMs = (input.cooldownDays ?? 60) * 86400_000;
  const limit = Math.max(1, Math.min(input.limit ?? 14, 60));
  const rates = measuredRates(input.history);

  const hist = new Map<string, SweepHistory>();
  for (const h of input.history) if (h.industry_key) hist.set(pairKey(h.city, h.region, h.industry_key), h);
  const queued = new Set(input.alreadyQueued.map((q) => `${norm(q.city)}|${norm(q.region)}|${norm(q.category)}`));
  const citiesWithDomain = new Set(input.campaigns.map((c) => `${norm(c.city)}|${norm(c.region)}`));

  // Candidates: every owned-domain pair, plus every pair we have swept before (to re-sweep after cooldown).
  const candidates = new Map<string, { city: string; region: string; industry: string; domain?: string; rank?: string | null }>();
  for (const c of input.campaigns) {
    if (!c.industry_key || !c.city || !c.region) continue;
    candidates.set(pairKey(c.city, c.region, c.industry_key), { city: c.city, region: c.region, industry: c.industry_key, domain: c.domain, rank: c.rank_status });
  }
  for (const h of input.history) {
    if (!h.industry_key || !h.city || !h.region) continue;
    const k = pairKey(h.city, h.region, h.industry_key);
    if (!candidates.has(k)) candidates.set(k, { city: h.city, region: h.region, industry: h.industry_key });
  }

  const plan: PlannedSweep[] = [];
  const skipped: Array<{ city: string; region: string; industry: string; why: string }> = [];
  for (const c of candidates.values()) {
    if (NEVER.has(c.industry)) { skipped.push({ ...c, why: 'not a trade' }); continue; }
    const category = input.categoryFor(c.industry);
    if (!category) { skipped.push({ ...c, why: `no sweep category for ${c.industry}` }); continue; }
    if (queued.has(`${norm(c.city)}|${norm(c.region)}|${norm(category)}`)) { skipped.push({ ...c, why: 'already queued' }); continue; }

    const reasons: string[] = [];
    let score = 0;
    const h = hist.get(pairKey(c.city, c.region, c.industry));
    if (h?.lastSweptAt && now.getTime() - new Date(h.lastSweptAt).getTime() < cooldownMs) {
      const days = Math.round((now.getTime() - new Date(h.lastSweptAt).getTime()) / 86400_000);
      skipped.push({ ...c, why: `swept ${days} day${days === 1 ? '' : 's'} ago` });
      continue;
    }
    if (c.domain) { score += 50; reasons.push(`we own ${c.domain}${c.rank && c.rank !== 'unranked' ? ` (${c.rank})` : ''}`); }
    else if (citiesWithDomain.has(`${norm(c.city)}|${norm(c.region)}`)) { score += 15; reasons.push('we own a domain in this city'); }

    const measured = rates[c.industry];
    const rate = measured ? measured.rate : (NO_WEBSITE_PRIOR[c.industry] ?? 0.15);
    score += Math.round(rate * 100);
    reasons.push(measured ? `${Math.round(rate * 100)}% no website, measured over ${measured.total}` : `~${Math.round(rate * 100)}% no website, prior`);

    if (h && h.total >= 5 && h.noWebsite / h.total < 0.1) { score -= 30; reasons.push(`this pair measured ${h.noWebsite}/${h.total} last time`); }
    else if (h && h.total >= 5) reasons.push(`re-sweep: ${h.noWebsite}/${h.total} no website last time`);

    plan.push({ city: c.city, region: c.region, industry: c.industry, category, priority: score, reasons });
  }

  plan.sort((a, b) => b.priority - a.priority || a.city.localeCompare(b.city));
  return { plan: plan.slice(0, limit), skipped };
}
