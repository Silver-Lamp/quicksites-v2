// The grep-your-defaults test from the honest-scaffold standard, made executable.
//
// A block default is a GENERATOR: it runs every time the block is created by any path, so a
// fabricated quote or rating sitting in one is not a placeholder — it is a fabrication with
// unlimited reach, authored once and emitted forever. The `testimonial` default shipped
// { quote: 'They did a great job!', attribution: 'Happy Client', rating: 5 } and reached a real
// named business's draft before anyone looked.
//
// This is the cheap check the standard asks implementers to run first, because a specimen in a
// default is the highest-reach instance — pulled before any generator audit.
// See crosstalk/contracts/honest-scaffold-standard.md.
import { DEFAULT_BLOCK_CONTENT } from '../defaultBlockContent';

/** Fields that assert a third party said or scored something. */
const CLAIM_FIELDS = ['quote', 'attribution', 'rating', 'author', 'reviewer', 'stars'];

function findClaims(node: any, path: string[] = []): string[] {
  if (node == null) return [];
  if (Array.isArray(node)) return node.flatMap((v, i) => findClaims(v, [...path, String(i)]));
  if (typeof node !== 'object') return [];
  const hits: string[] = [];
  for (const [k, v] of Object.entries(node)) {
    const here = [...path, k];
    // A truthy value in a claim field is a specimen. An empty string is an unfilled slot in a
    // shape — that's structure, which is exactly what a default is allowed to be.
    if (CLAIM_FIELDS.includes(k) && v !== '' && v !== null && v !== undefined && v !== false && v !== 0) {
      hits.push(`${here.join('.')} = ${JSON.stringify(v)}`);
    }
    hits.push(...findClaims(v, here));
  }
  return hits;
}

describe('block defaults never ship a fabricated third-party claim', () => {
  it('has no quote / attribution / rating specimen anywhere in defaultBlockContent', () => {
    const offenders: string[] = [];
    for (const [blockType, content] of Object.entries(DEFAULT_BLOCK_CONTENT as Record<string, any>)) {
      for (const hit of findClaims(content)) offenders.push(`${blockType}.${hit}`);
    }
    expect(offenders).toEqual([]);
  });

  // Proves the check can fail — a guard nobody has watched go red is a guard you don't have.
  it('detects a specimen if one is reintroduced', () => {
    const bad = { testimonial: { testimonials: [{ quote: 'They did a great job!', rating: 5 }] } };
    const hits = Object.entries(bad).flatMap(([t, c]) => findClaims(c).map((h) => `${t}.${h}`));
    expect(hits).toEqual(
      expect.arrayContaining([
        'testimonial.testimonials.0.quote = "They did a great job!"',
        'testimonial.testimonials.0.rating = 5',
      ]),
    );
  });

  it('allows an empty shape — structure is not a claim', () => {
    expect(findClaims({ testimonials: [] })).toEqual([]);
    expect(findClaims({ testimonials: [{ quote: '', attribution: '', rating: 0 }] })).toEqual([]);
  });
});
