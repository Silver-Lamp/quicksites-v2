// lib/prospects/growthCoach.ts
//
// Pure "what should I do next?" brain for the Growth Coach panel. Given a compact snapshot
// of the prospects funnel (all derived from data already on the page), it returns the funnel
// as ordered steps with a status + an optional one-click action, and picks the single
// highest-leverage next action. The UI renders it; every action maps to an existing endpoint.
// Pure + deterministic → unit-tested in isolation.

export type CoachStepStatus = 'done' | 'active' | 'todo' | 'blocked';

/** An action maps to a handler in the client (which calls the real endpoint). */
export type CoachActionKind =
  | 'discover'
  | 'launch-geo'
  | 'connect-gsc'
  | 'point-address'
  | 'refine'
  | 'mark-refined'
  | 'mail'
  // Restaurants playbook (the vertical view's coach):
  | 'build-drafts'
  | 'launch-restaurant-comp'
  | 'open-location-domains'
  | 'open-demand-funnel';

export type CoachAction = { kind: CoachActionKind; label: string; campaignId?: string | null };

export type CoachStep = {
  key: string;
  title: string;
  status: CoachStepStatus;
  detail: string;
  /** One-line "why this matters" for the learn-more affordance. */
  learn: string;
  action?: CoachAction;
};

export type CoachState = { headline: string; steps: CoachStep[]; primary: CoachAction | null };

/** The top opportunity's campaign state (from the ranked worklist + readiness). */
export type CoachTop = {
  campaignId: string;
  domain: string;
  templateId: string | null;
  orgId: string | null;
  ready: boolean;
  hardBlockers: number;
  competitors: number;
  /** A hard blocker is the missing NAP/click-to-call (fixable by pointing at the org address). */
  hasAddressBlocker: boolean;
};

export type CoachInput = {
  prospectCount: number;
  noWebsiteCount: number;
  /** Competition clusters that do NOT yet have a launched campaign. */
  openCompetitionGroups: number;
  campaignCount: number;
  /** Campaigns with any GSC data (connected to Search Console). */
  connectedRankCount: number;
  /** Campaigns actually ranking (page1 or ranking). */
  rankedCount: number;
  top: CoachTop | null;
  channels: { mail: boolean; sms: boolean };
  readinessGate: boolean;
};

export function computeCoachState(i: CoachInput): CoachState {
  const steps: CoachStep[] = [];

  // 1) Discover
  steps.push(
    i.prospectCount > 0
      ? { key: 'discover', title: 'Discover', status: 'done', detail: `${i.prospectCount} swept · ${i.noWebsiteCount} with no website`, learn: 'Sweeping a city finds local businesses (and which lack a website) to build claimable sites for.' }
      : { key: 'discover', title: 'Discover', status: 'active', detail: 'Sweep a city to find businesses with no website.', learn: 'Sweeping a city finds local businesses (and which lack a website) to build claimable sites for.', action: { kind: 'discover', label: 'Sweep a city' } },
  );

  // 2) Launch geo-domain campaigns from competition clusters
  if (i.openCompetitionGroups > 0) {
    steps.push({ key: 'launch', title: 'Grab the domain', status: 'active', detail: `${i.openCompetitionGroups} competition cluster${i.openCompetitionGroups === 1 ? '' : 's'} ready to launch`, learn: 'A cluster of no-website competitors → one exact-match geo-domain you own, rank, and rent.', action: { kind: 'launch-geo', label: `Launch a geo-domain campaign` } });
  } else {
    steps.push({ key: 'launch', title: 'Grab the domain', status: i.campaignCount > 0 ? 'done' : 'todo', detail: i.campaignCount > 0 ? `${i.campaignCount} campaign${i.campaignCount === 1 ? '' : 's'} launched` : 'Sweep more to find ≥2 no-website competitors in one trade.', learn: 'A cluster of no-website competitors → one exact-match geo-domain you own, rank, and rent.' });
  }

  // 3) Rank (mostly passive — connect GSC, then wait)
  if (i.campaignCount > 0) {
    if (i.connectedRankCount === 0) {
      steps.push({ key: 'rank', title: 'Rank', status: 'active', detail: 'No domains connected to Search Console yet.', learn: 'Connecting the domain to GSC is how we read live rank + prioritize which site to work.', action: { kind: 'connect-gsc', label: 'Connect Search Console' } });
    } else {
      steps.push({ key: 'rank', title: 'Rank', status: i.rankedCount > 0 ? 'done' : 'todo', detail: i.rankedCount > 0 ? `${i.rankedCount} ranking` : 'Indexed — ranking builds over the next few weeks.', learn: 'Rank quality drives which site is worth refining + mailing first.' });
    }
  }

  // 4) Refine the warmest asset — this is where the org-address auto-point slots in.
  const top = i.top;
  if (top) {
    if (top.ready) {
      steps.push({ key: 'refine', title: 'Refine', status: 'done', detail: `${top.domain} marked ready`, learn: 'A refined site (real copy, address, services) ranks + converts — never mail a placeholder.' });
    } else if (top.hasAddressBlocker && top.orgId) {
      // The automated address step: fix the missing NAP by pointing at the org service area.
      steps.push({ key: 'refine', title: 'Refine', status: 'active', detail: `${top.domain} has no address — point it at your org’s service area.`, learn: 'A missing address blocks outreach + hurts local relevance. Inherit your org’s service area until the operator sets their own.', action: { kind: 'point-address', label: `Point ${top.domain} at your service area`, campaignId: top.campaignId } });
    } else if (top.hardBlockers > 0) {
      steps.push({ key: 'refine', title: 'Refine', status: 'active', detail: `${top.domain} — ${top.hardBlockers} blocker${top.hardBlockers === 1 ? '' : 's'} to clear.`, learn: 'A refined site (real copy, address, services) ranks + converts — never mail a placeholder.', action: { kind: 'refine', label: `Refine ${top.domain}`, campaignId: top.campaignId } });
    } else {
      steps.push({ key: 'refine', title: 'Refine', status: 'active', detail: `${top.domain} looks refined — mark it ready.`, learn: 'Marking a site ready is your sign-off that it’s good enough to mail.', action: { kind: 'mark-refined', label: `Mark ${top.domain} ready`, campaignId: top.campaignId } });
    }
  }

  // 5) Outreach
  if (top) {
    if (top.ready) {
      const canMail = i.channels.mail;
      steps.push(canMail
        ? { key: 'outreach', title: 'Outreach', status: 'active', detail: `Mail the ${top.competitors} competing business${top.competitors === 1 ? '' : 'es'}.`, learn: 'A postcard with the claim link is how a real operator discovers + claims the ranked site.', action: { kind: 'mail', label: `Mail ${top.competitors} competitor${top.competitors === 1 ? '' : 's'}`, campaignId: top.campaignId } }
        : { key: 'outreach', title: 'Outreach', status: 'blocked', detail: 'Postcard mail is off (set LOB_API_KEY + POSTCARD_MAIL_ENABLED).', learn: 'A postcard with the claim link is how a real operator discovers + claims the ranked site.' });
    } else {
      steps.push({ key: 'outreach', title: 'Outreach', status: i.readinessGate ? 'blocked' : 'todo', detail: i.readinessGate ? 'Locked until the site is marked ready.' : 'Refine the site first (recommended).', learn: 'Refine before mailing so prospects see a real site, not a placeholder.' });
    }
  }

  const primary = steps.find((s) => s.status === 'active' && s.action)?.action ?? null;
  const headline = primary ? primary.label : (top ? `${top.domain} is ready — keep sweeping new cities for more.` : 'Sweep a city to start the funnel.');
  return { headline, steps, primary };
}

/* ────────────────────────── Restaurants playbook ──────────────────────────
 * The restaurant vertical runs a different funnel from the services rent model:
 * sweep no-website restaurants → build their OWN ordering sites (AI menu OCR) →
 * race a city cohort for the <city>-restaurant.com apex (first claim wins) →
 * send claim links/postcards → watch order-intent demand convert into claims.
 * Same CoachState shape, so the panel renders it unchanged.
 */

export type RestaurantCoachInput = {
  prospectCount: number; // restaurant prospects swept
  noWebsiteCount: number;
  /** No-website restaurants still without a draft (the AI-build backlog). */
  unbuiltNoWebsiteCount: number;
  /** Restaurants with their own built ordering site. */
  builtCount: number;
  /** Built city cohorts (≥2) not yet racing for an apex. */
  openCohorts: number;
  /** Live restaurant domain-contests (kind='restaurant_competition'). */
  contestCount: number;
  /** Contests already decided (someone claimed first). */
  decidedCount: number;
  /** Restaurants that claimed their site (in or out of a contest). */
  claimedCount: number;
  channels: { mail: boolean; sms: boolean };
};

export function computeRestaurantCoachState(i: RestaurantCoachInput): CoachState {
  const steps: CoachStep[] = [];

  // 1) Discover
  steps.push(
    i.prospectCount > 0
      ? { key: 'discover', title: 'Discover', status: 'done', detail: `${i.prospectCount} restaurants swept · ${i.noWebsiteCount} with no website`, learn: 'Sweeping a city finds restaurants with no website — the highest-intent cohort for a free ordering site.' }
      : { key: 'discover', title: 'Discover', status: 'active', detail: 'Sweep a city for restaurants with no website.', learn: 'Sweeping a city finds restaurants with no website — the highest-intent cohort for a free ordering site.', action: { kind: 'discover', label: 'Sweep a city' } },
  );

  // 2) Build their ordering sites (this is where the AI spend happens)
  if (i.unbuiltNoWebsiteCount > 0) {
    steps.push({ key: 'build', title: 'Build ordering sites', status: 'active', detail: `${i.unbuiltNoWebsiteCount} no-website restaurant${i.unbuiltNoWebsiteCount === 1 ? '' : 's'} without a draft yet.`, learn: 'Each restaurant gets its OWN working ordering site before first contact — menus read off listing photos by AI. The site is the pitch.', action: { kind: 'build-drafts', label: `Build ${i.unbuiltNoWebsiteCount} ordering site${i.unbuiltNoWebsiteCount === 1 ? '' : 's'}` } });
  } else {
    steps.push({ key: 'build', title: 'Build ordering sites', status: i.builtCount > 0 ? 'done' : 'todo', detail: i.builtCount > 0 ? `${i.builtCount} built` : 'Sweep a city first.', learn: 'Each restaurant gets its OWN working ordering site before first contact — menus read off listing photos by AI. The site is the pitch.' });
  }

  // 3) Start the domain contest — the scarcity mechanic
  if (i.openCohorts > 0) {
    steps.push({ key: 'contest', title: 'Start the contest', status: 'active', detail: `${i.openCohorts} built cohort${i.openCohorts === 1 ? '' : 's'} ready to race for a <city>-restaurant.com apex.`, learn: 'First restaurant to claim their site wins the city apex — a live directory that features them. Scarcity is the urgency.', action: { kind: 'launch-restaurant-comp', label: 'Start a domain contest' } });
  } else {
    steps.push({ key: 'contest', title: 'Start the contest', status: i.contestCount > 0 ? 'done' : 'todo', detail: i.contestCount > 0 ? `${i.contestCount} contest${i.contestCount === 1 ? '' : 's'} live${i.decidedCount ? ` · ${i.decidedCount} decided` : ''}` : 'Build 2+ sites in one city first.', learn: 'First restaurant to claim their site wins the city apex — a live directory that features them. Scarcity is the urgency.' });
  }

  // 4) Outreach — claim links + postcards, worked from the Location Domains cockpit
  const undecided = i.contestCount - i.decidedCount;
  if (i.contestCount > 0 && undecided > 0) {
    steps.push({ key: 'outreach', title: 'Send claim links', status: 'active', detail: `${undecided} contest${undecided === 1 ? '' : 's'} undecided — get the claim links in front of the owners.`, learn: 'Tracked claim links (postcards, texts, QR) attribute every visit; the first owner through wins the apex.', action: { kind: 'open-location-domains', label: 'Work the contests' } });
  } else {
    steps.push({ key: 'outreach', title: 'Send claim links', status: i.decidedCount > 0 ? 'done' : 'todo', detail: i.decidedCount > 0 ? 'All contests decided.' : 'Start a contest first.', learn: 'Tracked claim links (postcards, texts, QR) attribute every visit; the first owner through wins the apex.' });
  }

  // 5) Demand → claims — the proof loop
  if (i.claimedCount > 0) {
    steps.push({ key: 'demand', title: 'Demand → claims', status: 'done', detail: `${i.claimedCount} restaurant${i.claimedCount === 1 ? '' : 's'} claimed their site.`, learn: 'Order intents on unclaimed drafts escalate the pitch (“5 people tried to order”) until the owner claims.' });
  } else if (i.contestCount > 0 || i.builtCount > 0) {
    steps.push({ key: 'demand', title: 'Demand → claims', status: 'active', detail: 'Watch order intents accumulate on the drafts.', learn: 'Order intents on unclaimed drafts escalate the pitch (“5 people tried to order”) until the owner claims.', action: { kind: 'open-demand-funnel', label: 'Watch the demand funnel' } });
  } else {
    steps.push({ key: 'demand', title: 'Demand → claims', status: 'todo', detail: 'Build sites first.', learn: 'Order intents on unclaimed drafts escalate the pitch (“5 people tried to order”) until the owner claims.' });
  }

  const primary = steps.find((s) => s.status === 'active' && s.action)?.action ?? null;
  const headline = primary
    ? primary.label
    : i.claimedCount > 0
      ? `${i.claimedCount} claimed — sweep the next city.`
      : 'Sweep a city for restaurants to start the funnel.';
  return { headline, steps, primary };
}
