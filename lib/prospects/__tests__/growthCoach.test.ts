/**
 * @jest-environment node
 */
// lib/prospects/__tests__/growthCoach.test.ts

import { computeCoachState, computeRestaurantCoachState, type CoachInput, type CoachTop } from '@/lib/prospects/growthCoach';

const base: CoachInput = {
  prospectCount: 50,
  noWebsiteCount: 20,
  openCompetitionGroups: 0,
  campaignCount: 3,
  connectedRankCount: 3,
  rankedCount: 1,
  top: null,
  channels: { mail: true, sms: true },
  readinessGate: false,
  cohortlessCampaign: null,
};

const top = (over: Partial<CoachTop> = {}): CoachTop => ({
  campaignId: 'c1',
  domain: 'renton-plumbing.com',
  templateId: 't1',
  orgId: null,
  ready: false,
  hardBlockers: 0,
  competitors: 5,
  hasAddressBlocker: false,
  ...over,
});

describe('computeCoachState — primary next action', () => {
  it('says sweep a city when there are no prospects', () => {
    const s = computeCoachState({ ...base, prospectCount: 0, noWebsiteCount: 0, campaignCount: 0 });
    expect(s.primary?.kind).toBe('discover');
  });

  it('prioritizes launching when open competition clusters exist', () => {
    const s = computeCoachState({ ...base, openCompetitionGroups: 2 });
    expect(s.primary?.kind).toBe('launch-geo');
  });

  it('nudges connecting GSC when campaigns exist but none are connected', () => {
    const s = computeCoachState({ ...base, connectedRankCount: 0, rankedCount: 0, top: top() });
    // GSC connect comes before refine in the ordering
    expect(s.primary?.kind).toBe('connect-gsc');
  });

  it('offers the address auto-point when the top site is org-branded + missing NAP', () => {
    const s = computeCoachState({ ...base, top: top({ hasAddressBlocker: true, hardBlockers: 2, orgId: 'org1' }) });
    expect(s.primary?.kind).toBe('point-address');
    expect(s.primary?.campaignId).toBe('c1');
  });

  it('falls back to refine when blockers are not the address (or no org)', () => {
    const s = computeCoachState({ ...base, top: top({ hasAddressBlocker: true, hardBlockers: 2, orgId: null }) });
    expect(s.primary?.kind).toBe('refine');
  });

  it('suggests mark-refined when the top site has no hard blockers but is not ready', () => {
    const s = computeCoachState({ ...base, top: top({ hardBlockers: 0, ready: false }) });
    expect(s.primary?.kind).toBe('mark-refined');
  });

  it('suggests mailing once the top site is ready', () => {
    const s = computeCoachState({ ...base, top: top({ ready: true }) });
    expect(s.primary?.kind).toBe('mail');
    expect(s.headline).toContain('Mail');
  });

  it('blocks outreach when mail channel is off', () => {
    const s = computeCoachState({ ...base, channels: { mail: false, sms: false }, top: top({ ready: true }) });
    expect(s.primary).toBeNull();
    expect(s.steps.find((x) => x.key === 'outreach')?.status).toBe('blocked');
  });
});

describe('computeRestaurantCoachState (restaurants playbook)', () => {
  const rBase = {
    prospectCount: 0,
    noWebsiteCount: 0,
    unbuiltNoWebsiteCount: 0,
    builtCount: 0,
    openCohorts: 0,
    contestCount: 0,
    decidedCount: 0,
    claimedCount: 0,
    channels: { mail: true, sms: false },
  };

  it('empty funnel → sweep is the primary action', () => {
    const s = computeRestaurantCoachState(rBase);
    expect(s.primary?.kind).toBe('discover');
    expect(s.steps.map((x) => x.key)).toEqual(['discover', 'build', 'contest', 'outreach', 'demand']);
  });

  it('swept with unbuilt no-website restaurants → build is next', () => {
    const s = computeRestaurantCoachState({ ...rBase, prospectCount: 10, noWebsiteCount: 6, unbuiltNoWebsiteCount: 5 });
    expect(s.primary?.kind).toBe('build-drafts');
    expect(s.primary?.label).toBe('Build 5 ordering sites');
  });

  it('built cohort ready → start the contest', () => {
    const s = computeRestaurantCoachState({ ...rBase, prospectCount: 10, noWebsiteCount: 6, builtCount: 5, openCohorts: 1 });
    expect(s.primary?.kind).toBe('launch-restaurant-comp');
  });

  it('undecided contest → work the claim links (Location Domains)', () => {
    const s = computeRestaurantCoachState({ ...rBase, prospectCount: 10, builtCount: 5, contestCount: 1 });
    expect(s.primary?.kind).toBe('open-location-domains');
    expect(s.steps.find((x) => x.key === 'contest')?.status).toBe('done');
  });

  it('all contests decided + claims → funnel done, headline says sweep the next city', () => {
    const s = computeRestaurantCoachState({ ...rBase, prospectCount: 10, builtCount: 5, contestCount: 1, decidedCount: 1, claimedCount: 1 });
    expect(s.primary).toBeNull();
    expect(s.headline).toContain('sweep the next city');
    expect(s.steps.find((x) => x.key === 'demand')?.status).toBe('done');
  });
});

describe('the attach step — the gap between a swept city and a mailable one', () => {
  // ⚠️ Launching a campaign from a competition cluster links its cohort automatically, so this
  // state only appears via the adopt path (#890): a campaign that looks finished, a screenful of
  // prospects, and a mail step that finds no recipients. Without a step of its own it is invisible.
  const withCohortless = (attachable: number) =>
    computeCoachState({
      ...base,
      campaignCount: 1,
      cohortlessCampaign: attachable ? { id: 'c-1', domain: 'arab-towing.com', attachable } : null,
    });

  it('surfaces a campaign with nobody attached, and offers the attach', () => {
    const step = withCohortless(30).steps.find((s) => s.key === 'attach');
    expect(step).toBeDefined();
    expect(step!.status).toBe('active');
    expect(step!.detail).toMatch(/arab-towing\.com has nobody attached/);
    expect(step!.action).toMatchObject({ kind: 'attach-prospects', campaignId: 'c-1' });
  });

  it('says nothing when there is nobody to attach — no step for an unactionable state', () => {
    expect(withCohortless(0).steps.find((s) => s.key === 'attach')).toBeUndefined();
  });

  it('carries the campaign id, so the action can preselect the picker', () => {
    // Without this the step points at a control the operator still has to configure by hand,
    // which is the complaint it exists to fix.
    expect(withCohortless(5).steps.find((s) => s.key === 'attach')!.action!.campaignId).toBe('c-1');
  });

  it('places attach before the mail step, since mailing an empty cohort reaches nobody', () => {
    const keys = withCohortless(5).steps.map((s) => s.key);
    const a = keys.indexOf('attach');
    const m = keys.indexOf('outreach');
    expect(a).toBeGreaterThan(-1);
    if (m > -1) expect(a).toBeLessThan(m);
  });
});
