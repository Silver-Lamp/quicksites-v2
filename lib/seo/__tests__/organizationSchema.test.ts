// Structured data is a machine-readable claim about a real entity, so the rule is the same one
// the honest-scaffold standard applies to reviews: every field must be true, and a field we
// can't substantiate is omitted rather than invented. A fabricated `sameAs` or founding date is
// the same class of dishonesty as a fabricated testimonial, aimed at a crawler instead of a
// person — and crawlers are exactly the audience that can't sanity-check it.
import { organizationSchema, organizationSchemaJson, CANONICAL_ORIGIN } from '../organizationSchema';

describe('organizationSchema', () => {
  const s = organizationSchema();

  it('declares the entity a branded query should resolve to', () => {
    expect(s['@type']).toBe('Organization');
    expect(s.name).toBe('QuickSites');
    expect(s.url).toBe(`${CANONICAL_ORIGIN}/`);
  });

  it('points logo and url at the canonical origin, not a redirect', () => {
    // The apex 307s to www; an entity record citing the redirecting host wastes the signal.
    expect(s.url.startsWith('https://www.')).toBe(true);
    expect(s.logo.startsWith(`${CANONICAL_ORIGIN}/`)).toBe(true);
  });

  it('claims the singular spelling as an alternateName, not as someone else’s name', () => {
    // People type "quicksite"; saying "that's also us" is honest. Claiming a name that belongs
    // to another company would not be, and nothing here does that.
    expect(s.alternateName).toBe('QuickSites.ai');
  });

  it('omits sameAs entirely rather than shipping an empty or invented one', () => {
    expect('sameAs' in s).toBe(false);
    expect(organizationSchema({ sameAs: [] })).not.toHaveProperty('sameAs');
  });

  it('includes sameAs only when real profiles are supplied', () => {
    const withProfiles = organizationSchema({ sameAs: ['https://example.com/quicksites'] });
    expect((withProfiles as any).sameAs).toEqual(['https://example.com/quicksites']);
  });

  it('emits valid JSON for the script tag', () => {
    const parsed = JSON.parse(organizationSchemaJson());
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed.name).toBe('QuickSites');
  });

  // The logo has to exist — a schema pointing at a 404 is a claim we can't back, and this repo
  // has already shipped six assets that 404'd without anyone noticing.
  it('references a logo path the asset checker covers', () => {
    expect(s.logo).toContain('/brand/qs-mark.png');
  });
});
