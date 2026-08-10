import { findNearbyOffPlatform, queryTerms } from '../nearbyOffPlatform';

const p = (o: Partial<any> & { id: string; business_name: string }) => ({
  phone: '(425) 555-0000',
  address: '1 Main St',
  city: 'Renton',
  region: 'WA',
  categories: ['restaurant'],
  website: null,
  rating: 4.2,
  review_count: 50,
  ...o,
});

describe('queryTerms', () => {
  it('drops words that would match the whole city', () => {
    expect(queryTerms('best thai restaurant near me')).toEqual(['thai']);
    expect(queryTerms('restaurant')).toEqual([]);
  });

  it('ignores fragments too short to mean anything', () => {
    expect(queryTerms('a bb thai')).toEqual(['thai']);
  });
});

describe('findNearbyOffPlatform', () => {
  const rows = [
    p({ id: '1', business_name: 'Thai Kitchen', rating: 4.1 }),
    p({ id: '2', business_name: 'Bangkok House', categories: ['thai_restaurant'], rating: 4.8 }),
    p({ id: '3', business_name: "Joe's Pizza", categories: ['pizza_restaurant'] }),
    p({ id: '4', business_name: 'Kent Thai', city: 'Kent' }),
  ];

  it('matches on the business name', () => {
    const out = findNearbyOffPlatform(rows, { query: 'thai', city: 'Renton' });
    expect(out.map((m) => m.name)).toContain('Thai Kitchen');
  });

  it('matches on a Google category when the name gives nothing away', () => {
    const out = findNearbyOffPlatform(rows, { query: 'thai', city: 'Renton' });
    const bangkok = out.find((m) => m.name === 'Bangkok House');
    expect(bangkok?.matchReason).toBe('category');
  });

  // ⚠️ The UI may not claim more than the match was based on. A name match and a category match
  // are both guesses about cuisine — neither is evidence about a dish.
  it('reports what the match was based on', () => {
    const out = findNearbyOffPlatform(rows, { query: 'thai', city: 'Renton' });
    expect(out.find((m) => m.name === 'Thai Kitchen')?.matchReason).toBe('name');
  });

  it('ranks a name match above a better-reviewed category match', () => {
    const out = findNearbyOffPlatform(rows, { query: 'thai', city: 'Renton' });
    expect(out[0].name).toBe('Thai Kitchen'); // 4.1, name — beats Bangkok House at 4.8, category
  });

  it('excludes another city, matching the rule the drafts path uses', () => {
    const out = findNearbyOffPlatform(rows, { query: 'thai', city: 'Renton' });
    expect(out.map((m) => m.name)).not.toContain('Kent Thai');
  });

  it('returns nothing for an unrelated search rather than filler', () => {
    expect(findNearbyOffPlatform(rows, { query: 'sushi', city: 'Renton' })).toEqual([]);
  });

  it('returns nothing when the query carries no cuisine signal', () => {
    expect(findNearbyOffPlatform(rows, { query: 'food near me', city: 'Renton' })).toEqual([]);
  });

  it('caps the list — this is a suggestion, not a directory', () => {
    const many = Array.from({ length: 20 }, (_, i) =>
      p({ id: `x${i}`, business_name: `Thai ${i}` }),
    );
    expect(findNearbyOffPlatform(many, { query: 'thai', city: 'Renton' })).toHaveLength(4);
  });

  it('flags the no-website ones for the operator, without them reaching the diner payload', () => {
    const out = findNearbyOffPlatform(
      [p({ id: '9', business_name: 'Thai Nine', website: 'https://x.com' })],
      { query: 'thai', city: 'Renton' },
    );
    expect(out[0].noWebsite).toBe(false);
  });
});
