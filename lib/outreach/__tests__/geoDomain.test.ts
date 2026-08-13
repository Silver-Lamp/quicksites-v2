/**
 * @jest-environment node
 */
// City + industry → the exact-match domain, and the apex label that must agree with it.
import {
  geoDomainFor,
  apexSlugForDomain,
  restaurantApexCandidates,
  slugify,
} from '../geoDomain';

describe('geoDomainFor', () => {
  it('derives the canonical domain and a matching slug', () => {
    expect(geoDomainFor('Boston', 'towing' as any)).toEqual({
      domain: 'boston-towing.com',
      slug: 'boston-towing',
    });
  });

  it('uses the nicer word for compound industry keys', () => {
    expect(geoDomainFor('Kent', 'auto_repair' as any).domain).toBe('kent-auto-repair.com');
  });
});

describe('apexSlugForDomain', () => {
  // ⚠️ THE RULE THIS ENFORCES. The host→/sites/<slug> rewrite has NO mapping table — the apex label
  // IS the lookup. Both competition launchers used to set the slug from the CITY (always singular)
  // while honouring a domain override, so launching on any non-canonical domain bought a real
  // domain and pointed it at a slug nothing would ever create.
  it('takes the label from the domain, plural included', () => {
    expect(apexSlugForDomain('kent-restaurants.com')).toBe('kent-restaurants');
    expect(apexSlugForDomain('kent-restaurant.com')).toBe('kent-restaurant');
  });

  it('handles a multi-part TLD and stray case/space', () => {
    expect(apexSlugForDomain('  Kent-Restaurants.CO.UK ')).toBe('kent-restaurants');
  });

  it('round-trips whatever geoDomainFor produced', () => {
    const d = geoDomainFor('Federal Way', 'towing' as any);
    expect(apexSlugForDomain(d.domain)).toBe(d.slug);
  });
});

describe('restaurantApexCandidates', () => {
  // ⚠️ Plural leads on purpose: the domain's job is to match what a hungry person types, and that
  // is "kent restaurants". The singular is the internal convention, not the search term.
  it('offers the plural first', () => {
    const [first, second] = restaurantApexCandidates('Kent');
    expect(first).toEqual({ domain: 'kent-restaurants.com', slug: 'kent-restaurants' });
    expect(second).toEqual({ domain: 'kent-restaurant.com', slug: 'kent-restaurant' });
  });

  // ⚠️ Both forms are still offered. Renton's live contest sits on the SINGULAR; a search that only
  // knew about the plural would report a city we already run a contest in as buyable, and the
  // obvious next click buys a second domain for it. Which form we prefer must never change which
  // cities we can see we already own.
  it('still includes the singular, so an existing contest is findable', () => {
    expect(restaurantApexCandidates('Renton').map((c) => c.domain)).toContain(
      'renton-restaurant.com',
    );
  });

  it('keeps every slug consistent with its own domain', () => {
    for (const c of restaurantApexCandidates('Federal Way')) {
      expect(apexSlugForDomain(c.domain)).toBe(c.slug);
    }
  });

  it('respects a non-com tld on both forms', () => {
    expect(restaurantApexCandidates('Kent', 'menu').map((c) => c.domain)).toEqual([
      'kent-restaurants.menu',
      'kent-restaurant.menu',
    ]);
  });
});

describe('slugify', () => {
  it('collapses punctuation and trims edges', () => {
    expect(slugify('  Federal Way, WA! ')).toBe('federal-way-wa');
  });
});
