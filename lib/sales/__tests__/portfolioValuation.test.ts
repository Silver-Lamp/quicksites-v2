import { valuePortfolio } from '../portfolioValuation';
import { splitRentalPayment, stripeFeeCents } from '@/lib/commerce/rentalSplits';
import type { RateCardRow } from '../rateCard';

const row = (host: string, over: Partial<RateCardRow> = {}): RateCardRow => ({
  host, templateId: 't-1', slug: host.replace(/\.[a-z]+$/, ''), factsFound: true, qualifies: true, proofQuery: 'x towing', proofPosition: 4, proofAppearances: 20,
  otherPageOneQueries: [], city: 'X', state: 'WA', phone: '2535551212',
  fullCents: 39900, lockedCents: 9900, siteAveragePosition: 12, blockers: [], pitchable: true,
  ...over,
});

describe('the valuation counts only what we can prove', () => {
  it('ignores domains that do not hold page one', () => {
    const v = valuePortfolio([row('a.com'), row('b.com', { qualifies: false, proofQuery: null })]);
    expect(v.provenCount).toBe(1);
    expect(v.grossAtListCents).toBe(39900);
  });

  it('counts a domain that ranks but is blocked in the total, and separately as not pitchable', () => {
    // It IS inventory — the blocker is a missing phone number, which is a day's work, not a
    // reason to value it at zero. But a rep cannot sell it today and the figure must say so.
    const v = valuePortfolio([row('a.com'), row('b.com', { pitchable: false })]);
    expect(v.provenCount).toBe(2);
    expect(v.pitchableCount).toBe(1);
    expect(v.grossAtListCents).toBe(79800);
  });
});

describe('the house share is per rental, not a percentage of the total', () => {
  it('charges Stripe’s fixed fee once per domain, not once per portfolio', () => {
    const rows = [row('a.com'), row('b.com'), row('c.com')];
    const v = valuePortfolio(rows);
    // Summing three separate splits must cost MORE in fees than splitting one combined charge,
    // by exactly two extra fixed fees. Getting this wrong overstates the house by 60c/month —
    // small, but it is the kind of wrong that never gets found because it looks plausible.
    const combined = splitRentalPayment(39900 * 3);
    expect(v.houseAtListCents).toBeLessThan(combined.houseCents);
    const perRentalFees = 3 * stripeFeeCents(39900);
    expect(perRentalFees - stripeFeeCents(39900 * 3)).toBe(60);
  });

  it('never reports the house taking a flat 35% of gross', () => {
    const v = valuePortfolio([row('a.com')]);
    // The house takes the remainder of NET after the closer and manager, so it is strictly less
    // than 35% of what the customer paid.
    expect(v.houseAtListCents).toBeLessThan(Math.round(39900 * 0.35));
  });
});

describe('the hypothetical never loses its anchor', () => {
  it('reports rentedToday, defaulting to zero', () => {
    expect(valuePortfolio([row('a.com')]).rentedToday).toBe(0);
    expect(valuePortfolio([row('a.com')], { rentedToday: 1 }).rentedToday).toBe(1);
  });

  it('annualises as twelve months of the monthly ceiling and nothing cleverer', () => {
    const v = valuePortfolio([row('a.com')]);
    expect(v.annualAtListCents).toBe(v.grossAtListCents * 12);
  });

  it('shows per-domain lines, biggest first, so concentration is visible', () => {
    const v = valuePortfolio([
      row('small.com', { fullCents: 9900, lockedCents: 4900 }),
      row('big.com'),
    ]);
    expect(v.lines.map((l) => l.host)).toEqual(['big.com', 'small.com']);
    expect(v.grossAtFounderCents).toBe(9900 + 4900);
  });
});
