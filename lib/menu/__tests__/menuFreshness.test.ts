import { assessFreshness, priceOrConfirm, freshnessNote, PRICE_TRUST_DAYS } from '../menuFreshness';

const NOW = new Date('2026-07-29T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

describe('menu freshness', () => {
  // The whole reason this module exists: a photographed menu of unknown vintage must not be
  // quoted as fact. Unknown age is NOT fresh.
  it('treats an undated menu as price-stale', () => {
    const f = assessFreshness({}, NOW);
    expect(f.verifiedAt).toBeNull();
    expect(f.pricesStale).toBe(true);
    expect(priceOrConfirm('$13.00', f)).toBe('call to confirm');
  });

  it('trusts a recently verified menu', () => {
    const f = assessFreshness({ verified_at: daysAgo(10) }, NOW);
    expect(f.pricesStale).toBe(false);
    expect(priceOrConfirm('$13.00', f)).toBe('$13.00');
    expect(freshnessNote(f)).toBeNull();
  });

  it('stops trusting prices at the boundary', () => {
    expect(assessFreshness({ verified_at: daysAgo(PRICE_TRUST_DAYS - 1) }, NOW).pricesStale).toBe(false);
    expect(assessFreshness({ verified_at: daysAgo(PRICE_TRUST_DAYS) }, NOW).pricesStale).toBe(true);
  });

  it('flags a menu over a year old as stale outright', () => {
    const f = assessFreshness({ verified_at: daysAgo(400) }, NOW);
    expect(f.menuStale).toBe(true);
    expect(freshnessNote(f)).toMatch(/over a year old/);
  });

  // Two spellings of one field is the fleet's normal state, not the exception — menus arrive
  // from OCR, an operator menu run, and a claimed owner's editor.
  it('reads any of the accepted date spellings', () => {
    for (const key of ['verified_at', 'verifiedAt', 'sourced_at']) {
      expect(assessFreshness({ [key]: daysAgo(5) }, NOW).pricesStale).toBe(false);
    }
  });

  it('drops the price, never the dish', () => {
    const stale = assessFreshness({ verified_at: daysAgo(200) }, NOW);
    // An item with no price stays empty rather than growing a spurious "call to confirm".
    expect(priceOrConfirm(undefined, stale)).toBe('');
    expect(priceOrConfirm('$9', stale)).toBe('call to confirm');
  });

  it('ignores an unparseable date rather than throwing', () => {
    const f = assessFreshness({ verified_at: 'last tuesday' }, NOW);
    expect(f.verifiedAt).toBeNull();
    expect(f.pricesStale).toBe(true);
  });
});

describe('the renderer contract (regression: the rule had one caller)', () => {
  // ⚠️ assessFreshness existed, was tested, and was wired ONLY into the city search index — so
  // prices aged out in search results while the restaurant's own page quoted them as fact
  // forever. These lock the behaviour the menu renderer now depends on.
  it('treats an undated menu as unverified, because unknown age is not fresh', () => {
    const f = assessFreshness({ sections: [] });
    expect(f.verifiedAt).toBeNull();
    expect(f.pricesStale).toBe(true);
    expect(priceOrConfirm('$9.25', f)).toBe('call to confirm');
  });

  it('says so once, in a note a visitor can act on', () => {
    expect(freshnessNote(assessFreshness({}))).toMatch(/call/i);
  });

  it('quotes the price when a human verified it recently', () => {
    const f = assessFreshness({ verified_at: new Date().toISOString() });
    expect(f.pricesStale).toBe(false);
    expect(priceOrConfirm('$9.25', f)).toBe('$9.25');
  });

  // Drop the price, never the dish.
  it('never returns an empty label for a priced item', () => {
    expect(priceOrConfirm('$9.25', assessFreshness({}))).not.toBe('');
  });
});
