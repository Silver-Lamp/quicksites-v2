// lib/ops/nextSteps.ts
//
// The brain behind the ops dashboard's "next steps" — a prioritized, cross-domain
// worklist. It looks holistically (one top-5) AND per category (a top-5 each for
// Inventory / Markets / Clients), scoring each candidate action so the most valuable
// move floats to the top.
//
// The headline case it must surface: a domain that already RANKS on Google's front
// page (e.g. a pre-reboot geo domain like graftontowing.com) but isn't being
// monetized — turn that latent rank into a postcard challenge / rental. That signal
// comes from the live GSC per-domain position map crossed against our campaigns +
// owned inventory.
//
// Everything here is pure + deterministic (nowMs is injected) so it's unit-testable
// and can run on the server or client.

import { normalizeGscDomain } from '@/lib/gsc/normalizeDomain';
import type { InventoryDomain, DomainRollup } from '@/lib/domains/ownedInventory';
import type { GeoCampaign } from '@/lib/outreach/geoCampaigns';
import type { Prospect } from '@/lib/outreach/prospects';
import type { RankedOpportunity } from '@/lib/prospects/rankedOpportunities';

export type OpsCategory = 'inventory' | 'markets' | 'clients';
export type OpsSeverity = 'critical' | 'high' | 'medium' | 'low';

export type OpsStep = {
  id: string;
  category: OpsCategory;
  title: string;
  detail: string;
  severity: OpsSeverity;
  /** Higher = do sooner. Used to rank both the holistic and per-category top-5s. */
  score: number;
  href?: string;
  cta?: string;
};

export type OpsNextSteps = {
  /** The holistic top five across every category. */
  top: OpsStep[];
  /** Top five within each category. */
  byCategory: Record<OpsCategory, OpsStep[]>;
};

type GscStat = { clicks: number; impressions: number; position: number };

/** A page-1 domain and what we know about how (un)monetized it is. */
export type RankedDomainRef = {
  domain: string;
  position: number; // GSC 28-day avg position (1–10 = page one)
  clicks: number;
  impressions: number;
  campaignId: string | null;
  templateId: string | null;
  city: string | null;
  industryKey: string | null;
  competitors: number;
  rented: boolean;
  /** Monthly rent unlockable/collected for this domain, cents (0 when unknown). */
  monthlyRentCents: number;
};

export type OpsSignals = {
  inventory: {
    total: number;
    idleCount: number;
    unknownCostCount: number;
    netMonthlyCents: number;
    upcomingRenewals: { domain: string; expiresAt: string; renewalCents: number | null; rented: boolean }[];
  };
  markets: {
    rankedNotCapitalized: RankedDomainRef[];
    campaignsNeedingRefine: { campaignId: string; domain: string; templateId: string | null; hardBlockers: number }[];
    readyToMail: { campaignId: string; domain: string }[];
    openCompetitionGroups: number;
    noWebsiteProspects: number;
    prospectCount: number;
    channels: { mail: boolean; sms: boolean };
  };
  clients: {
    activeSubscribers: number;
    mrrCents: number;
    customers: number;
    repeatBuyers: number;
    lapsedCustomers: number;
    /** Total monthly rent sitting on ranking-but-not-rented domains, cents. */
    unrentedRankingRentCents: number;
  };
  nowMs: number;
};

const dollars = (cents: number) => `$${Math.round(cents / 100).toLocaleString()}`;
const GROWTH_HREF = '/admin/growth?tab=prospects';
const DOMAINS_HREF = '/admin/domains/costs';
const BILLING_HREF = '/admin/billing/map';

const SEV_BASE: Record<OpsSeverity, number> = { critical: 1000, high: 700, medium: 400, low: 150 };

function mkStep(s: Omit<OpsStep, 'score'>, bonus = 0): OpsStep {
  return { ...s, score: SEV_BASE[s.severity] + Math.max(0, bonus) };
}

const DAY_MS = 86_400_000;

// ── Signal assembly ────────────────────────────────────────────────────────────

/** Page-1 GSC domains we don't already know about (no campaign, not in inventory). */
export function pageOneOrphans(
  gscByDomain: Record<string, GscStat> | undefined,
  knownNormalizedDomains: Set<string>,
): { domain: string; stat: GscStat }[] {
  if (!gscByDomain) return [];
  const out: { domain: string; stat: GscStat }[] = [];
  for (const [key, stat] of Object.entries(gscByDomain)) {
    const norm = normalizeGscDomain(key);
    if (knownNormalizedDomains.has(norm)) continue;
    if (stat.position > 0 && stat.position <= 10) out.push({ domain: norm, stat });
  }
  return out;
}

/** Light parse of a geo domain (`grafton-towing.com` / `graftontowing.com`) → city hint. */
function domainCityHint(domain: string): string | null {
  const base = domain.replace(/\.[a-z.]+$/i, '');
  const parts = base.split('-').filter(Boolean);
  if (parts.length >= 2) return parts.slice(0, -1).join(' ');
  return null;
}

/**
 * Build the full signal bundle the dashboard feeds to computeOpsNextSteps. Pure —
 * every input is already-loaded data; nowMs is injected.
 */
export function buildOpsSignals(params: {
  inventory: { domains: InventoryDomain[]; rollup: DomainRollup };
  gscByDomain: Record<string, GscStat> | undefined;
  campaigns: GeoCampaign[];
  prospects: Prospect[];
  rankedOpportunities: RankedOpportunity[];
  clients: { activeSubscribers: number; mrrCents: number; customers: number; repeatBuyers: number; lapsedCustomers: number };
  channels: { mail: boolean; sms: boolean };
  openCompetitionGroups: number;
  nowMs: number;
}): OpsSignals {
  const { inventory, gscByDomain, campaigns, prospects, rankedOpportunities, clients, channels, openCompetitionGroups, nowMs } = params;

  const campaignById = new Map(campaigns.map((c) => [c.id, c]));
  const knownDomains = new Set<string>();
  for (const d of inventory.domains) knownDomains.add(normalizeGscDomain(d.domain));
  for (const c of campaigns) if (c.domain) knownDomains.add(normalizeGscDomain(c.domain));

  // Ranked-but-not-rented, campaign-backed (from the ranked worklist).
  const rankedNotCapitalized: RankedDomainRef[] = [];
  for (const o of rankedOpportunities) {
    if (o.rankStatus !== 'page1') continue;
    const camp = campaignById.get(o.campaignId);
    const rented = camp?.subscription_status === 'active';
    if (rented) continue; // already monetized
    rankedNotCapitalized.push({
      domain: normalizeGscDomain(o.domain),
      position: o.gsc?.position ?? 0,
      clicks: o.gsc?.clicks ?? 0,
      impressions: o.gsc?.impressions ?? 0,
      campaignId: o.campaignId,
      templateId: o.templateId,
      city: o.city,
      industryKey: o.industryKey,
      competitors: o.competitors,
      rented: false,
      monthlyRentCents: o.monthlyRentCents,
    });
  }
  // Orphan page-1 domains with no campaign at all (the pre-reboot "grafton" case).
  for (const { domain, stat } of pageOneOrphans(gscByDomain, knownDomains)) {
    rankedNotCapitalized.push({
      domain,
      position: stat.position,
      clicks: stat.clicks,
      impressions: stat.impressions,
      campaignId: null,
      templateId: null,
      city: domainCityHint(domain),
      industryKey: null,
      competitors: 0,
      rented: false,
      monthlyRentCents: 0,
    });
  }
  // Best rank (lowest position) first.
  rankedNotCapitalized.sort((a, b) => a.position - b.position);

  const campaignsNeedingRefine: OpsSignals['markets']['campaignsNeedingRefine'] = [];
  const readyToMail: OpsSignals['markets']['readyToMail'] = [];
  for (const c of campaigns) {
    if (c.status === 'archived') continue;
    const blockers = Array.isArray(c.outreach_blockers) ? c.outreach_blockers : [];
    const hard = blockers.filter((b: any) => b?.severity === 'hard').length;
    if (hard > 0) campaignsNeedingRefine.push({ campaignId: c.id, domain: c.domain, templateId: c.template_id, hardBlockers: hard });
    else if (c.outreach_ready_at && c.subscription_status !== 'active') readyToMail.push({ campaignId: c.id, domain: c.domain });
  }

  const upcomingRenewals = inventory.domains
    .filter((d) => {
      if (!d.expiresAt) return false;
      const t = new Date(d.expiresAt).getTime();
      if (Number.isNaN(t)) return false;
      const days = (t - nowMs) / DAY_MS;
      return days <= 45; // due within ~6 weeks (incl. overdue)
    })
    .map((d) => ({ domain: d.domain, expiresAt: d.expiresAt as string, renewalCents: d.renewalCents, rented: d.rented }));

  const noWebsiteProspects = prospects.filter((p) => p.lead_tier === 'no_website' && p.status === 'discovered').length;
  const unrentedRankingRentCents = rankedNotCapitalized.reduce((s, r) => s + r.monthlyRentCents, 0);

  return {
    inventory: {
      total: inventory.rollup.count,
      idleCount: inventory.rollup.idleCount,
      unknownCostCount: inventory.rollup.withUnknownCost,
      netMonthlyCents: inventory.rollup.netMonthlyCents,
      upcomingRenewals,
    },
    markets: {
      rankedNotCapitalized,
      campaignsNeedingRefine,
      readyToMail,
      openCompetitionGroups,
      noWebsiteProspects,
      prospectCount: prospects.length,
      channels,
    },
    clients: {
      ...clients,
      unrentedRankingRentCents,
    },
    nowMs,
  };
}

// ── Prioritization ───────────────────────────────────────────────────────────────

function inventorySteps(s: OpsSignals): OpsStep[] {
  const steps: OpsStep[] = [];
  const inv = s.inventory;

  const idleRenewals = inv.upcomingRenewals.filter((r) => !r.rented);
  if (idleRenewals.length) {
    const sum = idleRenewals.reduce((a, r) => a + (r.renewalCents ?? 0), 0);
    steps.push(
      mkStep(
        {
          id: 'inv-renewals',
          category: 'inventory',
          severity: 'high',
          title: `${idleRenewals.length} unmonetized domain${idleRenewals.length === 1 ? '' : 's'} renew soon`,
          detail: `${sum ? `${dollars(sum)} due within 45 days. ` : ''}Rank, rent, or drop them before you pay to renew.`,
          href: DOMAINS_HREF,
          cta: 'Review renewals',
        },
        Math.round(sum / 100),
      ),
    );
  }

  if (inv.unknownCostCount > 0) {
    steps.push(
      mkStep(
        {
          id: 'inv-unknown-cost',
          category: 'inventory',
          severity: 'medium',
          title: `Add renewal cost for ${inv.unknownCostCount} domain${inv.unknownCostCount === 1 ? '' : 's'}`,
          detail: 'These have no cost on file, so the spend projection understates your true burn.',
          href: DOMAINS_HREF,
          cta: 'Enter costs',
        },
        inv.unknownCostCount * 10,
      ),
    );
  }

  if (inv.netMonthlyCents > 0) {
    steps.push(
      mkStep(
        {
          id: 'inv-net-burn',
          category: 'inventory',
          severity: inv.netMonthlyCents > 5000 ? 'high' : 'medium',
          title: `Net domain burn is ${dollars(inv.netMonthlyCents)}/mo`,
          detail: `${inv.idleCount} idle domain${inv.idleCount === 1 ? '' : 's'} earn nothing. Rank + rent them to push net below zero.`,
          href: DOMAINS_HREF,
          cta: 'Open cost dashboard',
        },
        Math.round(inv.netMonthlyCents / 100),
      ),
    );
  }

  return steps;
}

function marketSteps(s: OpsSignals): OpsStep[] {
  const steps: OpsStep[] = [];
  const m = s.markets;

  for (const r of m.rankedNotCapitalized) {
    const posLabel = r.position ? ` (ranks #${r.position.toFixed(r.position % 1 ? 1 : 0)})` : '';
    const rentLabel = r.monthlyRentCents ? ` — up to ${dollars(r.monthlyRentCents)}/mo` : '';
    const hasCampaign = !!r.campaignId;
    // Rank bonus: #1 → +450, #10 → +0. Plus rent potential.
    const bonus = Math.max(0, (11 - (r.position || 11)) * 50) + Math.round(r.monthlyRentCents / 100);
    steps.push(
      mkStep(
        {
          id: `mkt-rank-${r.domain}`,
          category: 'markets',
          severity: 'high',
          title: hasCampaign
            ? `Launch a postcard challenge for ${r.domain}${posLabel}`
            : `Capitalize on ${r.domain}${posLabel}`,
          detail: hasCampaign
            ? `Already ranking${rentLabel}. ${r.competitors ? `${r.competitors} competing business${r.competitors === 1 ? '' : 'es'} — ` : ''}mail the challenge to convert rank into rent.`
            : `This domain ranks on page one but has no campaign yet. Set one up${r.city ? ` for ${r.city}` : ''} and run a postcard challenge to monetize it.`,
          href: hasCampaign && r.templateId ? `/admin/templates/${r.templateId}` : GROWTH_HREF,
          cta: hasCampaign ? 'Launch challenge' : 'Set up campaign',
        },
        bonus,
      ),
    );
  }

  if (m.readyToMail.length && m.channels.mail) {
    steps.push(
      mkStep(
        {
          id: 'mkt-ready-mail',
          category: 'markets',
          severity: 'high',
          title: `${m.readyToMail.length} site${m.readyToMail.length === 1 ? '' : 's'} refined & ready to mail`,
          detail: `Postcards are unblocked for ${m.readyToMail.slice(0, 3).map((r) => r.domain).join(', ')}${m.readyToMail.length > 3 ? '…' : ''}. Send them.`,
          href: GROWTH_HREF,
          cta: 'Mail postcards',
        },
        m.readyToMail.length * 30,
      ),
    );
  }

  if (m.campaignsNeedingRefine.length) {
    steps.push(
      mkStep(
        {
          id: 'mkt-refine',
          category: 'markets',
          severity: 'medium',
          title: `Refine ${m.campaignsNeedingRefine.length} pitch site${m.campaignsNeedingRefine.length === 1 ? '' : 's'} before outreach`,
          detail: `Clear the hard blockers (NAP, tap-to-call, real hero) so these can be mailed.`,
          href: GROWTH_HREF,
          cta: 'Refine sites',
        },
        m.campaignsNeedingRefine.length * 15,
      ),
    );
  }

  if (m.openCompetitionGroups > 0) {
    steps.push(
      mkStep(
        {
          id: 'mkt-grab-domains',
          category: 'markets',
          severity: 'medium',
          title: `Grab ${m.openCompetitionGroups} open geo-domain${m.openCompetitionGroups === 1 ? '' : 's'}`,
          detail: `Competition clusters of no-website businesses are waiting on an exact-match domain launch.`,
          href: GROWTH_HREF,
          cta: 'Launch campaigns',
        },
        m.openCompetitionGroups * 20,
      ),
    );
  }

  if (m.noWebsiteProspects > 0) {
    steps.push(
      mkStep(
        {
          id: 'mkt-build-sites',
          category: 'markets',
          severity: 'low',
          title: `Build sites for ${m.noWebsiteProspects} no-website prospect${m.noWebsiteProspects === 1 ? '' : 's'}`,
          detail: `Turn discovered leads into claimable draft sites you can pitch.`,
          href: GROWTH_HREF,
          cta: 'Build drafts',
        },
        Math.min(m.noWebsiteProspects, 50),
      ),
    );
  }

  return steps;
}

function clientSteps(s: OpsSignals): OpsStep[] {
  const steps: OpsStep[] = [];
  const c = s.clients;

  if (c.unrentedRankingRentCents > 0) {
    steps.push(
      mkStep(
        {
          id: 'cli-unlock-rent',
          category: 'clients',
          severity: 'high',
          title: `Up to ${dollars(c.unrentedRankingRentCents)}/mo in unrented rank`,
          detail: `Ranking domains that aren't rented yet. Convert them to recurring rent — the fastest revenue on the board.`,
          href: GROWTH_HREF,
          cta: 'Convert to rent',
        },
        Math.round(c.unrentedRankingRentCents / 100),
      ),
    );
  }

  if (c.lapsedCustomers > 0) {
    steps.push(
      mkStep(
        {
          id: 'cli-reengage',
          category: 'clients',
          severity: 'medium',
          title: `Re-engage ${c.lapsedCustomers} lapsed customer${c.lapsedCustomers === 1 ? '' : 's'}`,
          detail: `No order in 90+ days. Send a win-back email campaign to the opted-in segment (merchant → Campaigns).`,
        },
        Math.min(c.lapsedCustomers, 40),
      ),
    );
  }

  if (c.activeSubscribers === 0 && c.customers > 0) {
    steps.push(
      mkStep(
        {
          id: 'cli-first-sub',
          category: 'clients',
          severity: 'medium',
          title: `No paying subscribers yet — ${c.customers} buyer${c.customers === 1 ? '' : 's'} to convert`,
          detail: `You have order activity but no recurring plans. Pitch an agency/site plan to your buyers.`,
          href: BILLING_HREF,
          cta: 'View billing',
        },
        20,
      ),
    );
  } else if (c.repeatBuyers > 0) {
    steps.push(
      mkStep(
        {
          id: 'cli-upsell-repeat',
          category: 'clients',
          severity: 'low',
          title: `${c.repeatBuyers} repeat buyer${c.repeatBuyers === 1 ? '' : 's'} to upsell`,
          detail: `Repeat customers are your warmest upgrade audience. Offer a plan or add-on via a merchant campaign.`,
        },
        Math.min(c.repeatBuyers, 30),
      ),
    );
  }

  return steps;
}

const bySeverityThenScore = (a: OpsStep, b: OpsStep) => b.score - a.score;

/** The prioritized cross-domain worklist: a holistic top-5 plus a top-5 per category. */
export function computeOpsNextSteps(s: OpsSignals): OpsNextSteps {
  const inv = inventorySteps(s).sort(bySeverityThenScore);
  const mkt = marketSteps(s).sort(bySeverityThenScore);
  const cli = clientSteps(s).sort(bySeverityThenScore);

  const top = [...inv, ...mkt, ...cli].sort(bySeverityThenScore).slice(0, 5);

  return {
    top,
    byCategory: {
      inventory: inv.slice(0, 5),
      markets: mkt.slice(0, 5),
      clients: cli.slice(0, 5),
    },
  };
}
