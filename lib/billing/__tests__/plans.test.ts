// lib/billing/__tests__/plans.test.ts
import {
  isAgencyPlan,
  isPaidPlan,
  planForTier,
  PLAN_AGENCY,
  PLAN_AGENCY_FOUNDER,
} from '../plans';

describe('isAgencyPlan', () => {
  it('is true for any agency tier (case-insensitive)', () => {
    expect(isAgencyPlan('agency')).toBe(true);
    expect(isAgencyPlan('agency_founder')).toBe(true);
    expect(isAgencyPlan('AGENCY')).toBe(true);
  });

  it('is false for non-agency labels and nullish', () => {
    expect(isAgencyPlan('free')).toBe(false);
    expect(isAgencyPlan('')).toBe(false);
    expect(isAgencyPlan(null)).toBe(false);
    expect(isAgencyPlan(undefined)).toBe(false);
  });
});

describe('isPaidPlan', () => {
  it('is true for any non-free label', () => {
    expect(isPaidPlan('agency')).toBe(true);
    expect(isPaidPlan('agency_founder')).toBe(true);
  });

  it('is false for free / none / empty / nullish', () => {
    expect(isPaidPlan('free')).toBe(false);
    expect(isPaidPlan('none')).toBe(false);
    expect(isPaidPlan('')).toBe(false);
    expect(isPaidPlan(null)).toBe(false);
    expect(isPaidPlan(undefined)).toBe(false);
  });
});

describe('planForTier', () => {
  it('maps founder/public to the canonical persisted labels', () => {
    expect(planForTier('founder')).toBe(PLAN_AGENCY_FOUNDER);
    expect(planForTier('public')).toBe(PLAN_AGENCY);
  });
});
