import {
  SPLIT,
  splitRentalPayment,
  splitOnGrossForComparison,
  stripeFeeCents,
  monthlyEquivalentCents,
  formatCents,
} from '@/lib/commerce/rentalSplits';

describe('stripeFeeCents', () => {
  it('is 2.9% + 30c on the two live tiers', () => {
    expect(stripeFeeCents(9900)).toBe(317); // $3.17 on $99
    expect(stripeFeeCents(39900)).toBe(1187); // $11.87 on $399
  });

  it('is zero on a zero charge rather than the bare fixed fee', () => {
    // A campaign with no plan must not report that it cost 30c to collect nothing.
    expect(stripeFeeCents(0)).toBe(0);
  });
});

describe('splitRentalPayment', () => {
  it('divides the $99 founder tier 50/15/35 of NET', () => {
    const s = splitRentalPayment(9900, 'standard');
    expect(s.feeCents).toBe(317);
    expect(s.netCents).toBe(9583);
    expect(s.closerCents).toBe(4791); // $47.91
    expect(s.managerCents).toBe(1437); // $14.37
    expect(s.houseCents).toBe(3355); // $33.55 — remainder, carries the dust
  });

  it('divides the $399 ranked tier on the same percentages', () => {
    const s = splitRentalPayment(39900, 'standard');
    expect(s.netCents).toBe(38713);
    expect(s.closerCents).toBe(19356);
    expect(s.managerCents).toBe(5806);
    expect(s.houseCents).toBe(13551);
  });

  it('funds the recruit override out of the HOUSE, never the closer', () => {
    const std = splitRentalPayment(9900, 'standard');
    const rec = splitRentalPayment(9900, 'recruit');

    // The closer is untouched — this is the whole point of the variant.
    expect(rec.closerCents).toBe(std.closerCents);
    // Every extra cent the manager gains comes out of the house.
    expect(rec.managerCents - std.managerCents).toBe(std.houseCents - rec.houseCents);
  });

  it('always sums to net exactly, at every price in a wide sweep', () => {
    // A split that is one cent off is a split someone reconciles by hand every month.
    for (let gross = 0; gross <= 60000; gross += 7) {
      for (const variant of ['standard', 'recruit'] as const) {
        const s = splitRentalPayment(gross, variant);
        expect(s.closerCents + s.managerCents + s.houseCents).toBe(s.netCents);
      }
    }
  });

  it('never pays out more than arrived, and never pays a negative share', () => {
    for (const gross of [0, 1, 29, 30, 31, 100, 9900, 39900]) {
      const s = splitRentalPayment(gross);
      expect(s.netCents).toBeGreaterThanOrEqual(0);
      expect(s.closerCents).toBeGreaterThanOrEqual(0);
      expect(s.managerCents).toBeGreaterThanOrEqual(0);
      expect(s.houseCents).toBeGreaterThanOrEqual(0);
      expect(s.closerCents + s.managerCents + s.houseCents).toBeLessThanOrEqual(s.grossCents);
    }
  });

  it('gives the house the rounding dust rather than dropping it', () => {
    // 35% of 9583 is 3354.05; the house gets 3355 because it takes the remainder.
    const s = splitRentalPayment(9900);
    expect(s.houseCents).toBeGreaterThan(Math.floor(s.netCents * 0.35));
  });

  it('holds the closer at half of net across tiers', () => {
    for (const gross of [9900, 39900, 12345]) {
      const s = splitRentalPayment(gross);
      expect(s.shares.closer).toBeCloseTo(SPLIT.closer, 3);
    }
  });
});

describe('splitOnGrossForComparison', () => {
  it('shows the house absorbing the whole processing fee', () => {
    const net = splitRentalPayment(9900, 'standard');
    const gross = splitOnGrossForComparison(9900, 'standard');

    // The napkin rule pays the reps more and the house less by exactly the fee split.
    expect(gross.closerCents).toBe(4950);
    expect(gross.managerCents).toBe(1485);
    expect(gross.houseCents).toBe(3148); // $31.48, vs $33.55 on the net rule
    expect(net.houseCents).toBeGreaterThan(gross.houseCents);
  });

  it('costs the house most in the recruit variant at the founder rate', () => {
    // The thinnest slice in the model, on the tier that is locked for life.
    const gross = splitOnGrossForComparison(9900, 'recruit');
    expect(gross.houseCents).toBe(2158); // $21.58
  });
});

describe('monthlyEquivalentCents', () => {
  it('normalises the intervals a rental can bill on', () => {
    expect(monthlyEquivalentCents(9900, 'month')).toBe(9900);
    expect(monthlyEquivalentCents(100, 'day')).toBe(3044);
    expect(monthlyEquivalentCents(39900, 'year')).toBe(3325);
  });

  it('treats an unset interval as monthly, matching the checkout fallback', () => {
    // The rent route defaults an unrecognised interval to 'month'; this must agree or
    // the page reports a different figure than the customer is actually charged.
    expect(monthlyEquivalentCents(9900, null)).toBe(9900);
    expect(monthlyEquivalentCents(9900, 'fortnight')).toBe(9900);
  });
});

describe('formatCents', () => {
  it('renders money, and a dash rather than $NaN for missing values', () => {
    expect(formatCents(9900)).toBe('$99.00');
    expect(formatCents(3355)).toBe('$33.55');
    expect(formatCents(null)).toBe('—');
    expect(formatCents(undefined)).toBe('—');
  });
});

describe('the residual rule is stated the same way everywhere', () => {
  // A rep's page promising "life of the account" while the operator's page says "12-month
  // tail" is the worst kind of drift: two surfaces disagreeing about what a person is owed,
  // discovered by that person. This pins them together.
  // Collapse whitespace: prettier reflows prose across lines, and a phrase split by a line
  // break is the same promise. Matching raw source would fail on formatting, not on meaning.
  const read = (p: string) =>
    require('fs').readFileSync(require('path').join(process.cwd(), p), 'utf8').replace(/\s+/g, ' ');

  it('no surface promises a fixed post-departure tail', () => {
    for (const p of [
      'lib/commerce/rentalSplits.ts',
      'app/admin/splits/page.tsx',
      'app/for-shelly/page.tsx',
    ]) {
      expect(read(p)).not.toMatch(/RESIDUAL_TAIL_MONTHS|month tail|12-month tail/);
    }
  });

  it('ties the residual to the role on both the operator and the rep surface', () => {
    expect(read('lib/commerce/rentalSplits.ts')).toContain("RESIDUAL_BASIS = 'role'");
    expect(read('app/admin/splits/page.tsx')).toMatch(/follows the role/i);
    expect(read('app/for-shelly/page.tsx')).toMatch(/stay the\s+rep on the accounts/i);
  });

  it('would catch the old wording — this matcher is not inert', () => {
    expect(/RESIDUAL_TAIL_MONTHS|month tail/.test('a 12-month tail after they leave')).toBe(true);
    expect(/RESIDUAL_TAIL_MONTHS|month tail/.test('follows the role, not tenure')).toBe(false);
  });
});
