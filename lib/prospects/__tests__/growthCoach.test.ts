/**
 * @jest-environment node
 */
// lib/prospects/__tests__/growthCoach.test.ts

import { computeCoachState, type CoachInput, type CoachTop } from '@/lib/prospects/growthCoach';

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
