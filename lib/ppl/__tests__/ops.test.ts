/**
 * @jest-environment node
 */
// lib/ppl/__tests__/ops.test.ts — the ops page's pure parts: the 30-day call cuts and the
// §10 sequence status. The page must never say "do now" for a step whose predecessor is not
// done, and must never count an unanswered or short call as qualified.

import { deriveSteps, summariseCalls } from '@/lib/ppl/ops';

const now = Date.parse('2026-09-18T20:00:00Z');
const day = 86_400_000;

describe('summariseCalls', () => {
  it('counts only the last 30 days, per campaign, and qualifies ≥ 90 s answered calls', () => {
    const r = summariseCalls(
      [
        {
          geo_campaign_id: 'a',
          call_duration: 120,
          created_at: new Date(now - 2 * day).toISOString(),
          call_status: 'completed',
        },
        {
          geo_campaign_id: 'a',
          call_duration: 30,
          created_at: new Date(now - 3 * day).toISOString(),
          call_status: 'completed',
        },
        {
          geo_campaign_id: 'a',
          call_duration: 200,
          created_at: new Date(now - 40 * day).toISOString(),
          call_status: 'completed',
        },
        {
          geo_campaign_id: 'b',
          call_duration: 95,
          created_at: new Date(now - 1 * day).toISOString(),
          call_status: 'dial-no-answer',
        },
        {
          geo_campaign_id: null,
          call_duration: 500,
          created_at: new Date(now - 1 * day).toISOString(),
          call_status: 'completed',
        },
      ],
      now
    );
    expect(r.calls).toBe(3);
    expect(r.qualified).toBe(1);
    expect(r.per.get('a')).toMatchObject({ calls: 2, qualified: 1 });
    expect(r.per.get('b')).toMatchObject({ calls: 1, qualified: 0 });
  });
});

describe('deriveSteps', () => {
  const base = {
    smsReady: false,
    callTracking: false,
    pplFlag: false,
    campaignsWithNumber: 0,
    graftonAttached: false,
    calls30d: 0,
    accounts: 0,
    accountsActive: 0,
    leadCharges: 0,
  };
  const status = (i: Parameters<typeof deriveSteps>[0]) => deriveSteps(i).map((s) => s.status);

  it('with nothing configured, only step 0 is actionable', () => {
    const st = status(base);
    expect(st[0]).toBe('ready');
    expect(st.slice(1).every((x) => x === 'blocked')).toBe(true);
  });
  it('creds in → the Grafton attach and the notice become actionable, nothing downstream', () => {
    const st = status({ ...base, smsReady: true });
    expect(st[0]).toBe('done');
    expect(st[1]).toBe('ready');
    expect(st[3]).toBe('ready');
    expect(st[2]).toBe('blocked');
    expect(st[6]).toBe('blocked');
  });
  it('the first billed call is done only when a lead charge exists', () => {
    expect(
      status({
        ...base,
        smsReady: true,
        graftonAttached: true,
        campaignsWithNumber: 1,
        accounts: 1,
        accountsActive: 1,
        pplFlag: true,
      })[7]
    ).toBe('waiting');
    expect(
      status({
        ...base,
        smsReady: true,
        graftonAttached: true,
        campaignsWithNumber: 1,
        accounts: 1,
        accountsActive: 1,
        pplFlag: true,
        leadCharges: 1,
      })[7]
    ).toBe('done');
  });
  it('the cohort step needs the call-tracking flag, not just creds', () => {
    expect(status({ ...base, smsReady: true })[4]).toBe('blocked');
    expect(status({ ...base, smsReady: true, callTracking: true })[4]).toBe('ready');
  });
});
