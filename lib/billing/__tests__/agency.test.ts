// lib/billing/__tests__/agency.test.ts
import { buildAgencyLineItems, agencyDiscountConfig } from '../agency';

const ORIGINAL_ENV = process.env;

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('buildAgencyLineItems', () => {
  beforeEach(() => {
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_PRICE_AGENCY_PLATFORM: 'price_platform',
      STRIPE_PRICE_AGENCY_PERSITE: 'price_persite',
    };
  });

  it('builds a platform line (qty 1) + a per-site line (qty = #sites)', () => {
    expect(buildAgencyLineItems(3)).toEqual([
      { price: 'price_platform', quantity: 1 },
      { price: 'price_persite', quantity: 3 },
    ]);
  });

  it('clamps the per-site quantity to at least 1', () => {
    expect(buildAgencyLineItems(0)[1].quantity).toBe(1);
    expect(buildAgencyLineItems(-5 as any)[1].quantity).toBe(1);
    expect(buildAgencyLineItems(2.9 as any)[1].quantity).toBe(2); // floored
  });

  it('throws when the price IDs are not configured', () => {
    process.env = { ...ORIGINAL_ENV, STRIPE_PRICE_AGENCY_PLATFORM: '', STRIPE_PRICE_AGENCY_PERSITE: '' };
    expect(() => buildAgencyLineItems(1)).toThrow(/not configured/i);
  });
});

describe('agencyDiscountConfig', () => {
  it('founder with configured coupons → discounts (no promo codes)', () => {
    process.env = { ...ORIGINAL_ENV, STRIPE_COUPON_AGENCY_FOUNDER: 'cpn_a,cpn_b' };
    expect(agencyDiscountConfig('founder')).toEqual({
      discounts: [{ coupon: 'cpn_a' }, { coupon: 'cpn_b' }],
    });
  });

  it('founder without coupons → falls back to promo codes', () => {
    process.env = { ...ORIGINAL_ENV, STRIPE_COUPON_AGENCY_FOUNDER: '' };
    expect(agencyDiscountConfig('founder')).toEqual({ allow_promotion_codes: true });
  });

  it('public tier → promo codes (never coupon discounts)', () => {
    process.env = { ...ORIGINAL_ENV, STRIPE_COUPON_AGENCY_FOUNDER: 'cpn_a' };
    expect(agencyDiscountConfig('public')).toEqual({ allow_promotion_codes: true });
  });
});
