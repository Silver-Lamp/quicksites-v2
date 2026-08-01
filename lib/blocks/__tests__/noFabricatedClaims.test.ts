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

// ⚠️ THE SECOND SHAPE: INVENTED PEOPLE.
//
// The guard above checks CLAIM_FIELDS — quote / attribution / rating / author / reviewer /
// stars. An `agent_roster` entry has none of those, so three fabricated employees sailed
// straight past it and sat on main: "Jordan Avery, Listing Agent — fifteen years matching
// families to the right block", plus a Buyer's Agent and a Broker, each with a biography.
//
// An agency that dropped the block on its site and didn't fully edit it published a staff page
// for a team it never hired. A review invents an opinion; this invents COLLEAGUES — people a
// prospective client might try to phone. Rule 9 (no generated people) applied to words.
//
// Detecting it by field name alone doesn't work: `name` is also a dish, a menu section and an
// event. What makes an object a PERSON is a name sitting next to a bio, a photo, or a job
// title — so that pairing is the test, and dishes stay out of it.
describe('block defaults invent no people', () => {
  const PERSON_MARKERS = ['bio', 'photo_url', 'avatar_url', 'headshot_url', 'title', 'role'];

  /** Every object in the defaults that looks like a person record. */
  function personShaped(node: any, path: string, out: Array<{ path: string; obj: any }> = []) {
    if (Array.isArray(node)) {
      node.forEach((v, i) => personShaped(v, `${path}[${i}]`, out));
      return out;
    }
    if (node && typeof node === 'object') {
      const keys = Object.keys(node);
      if (keys.includes('name') && PERSON_MARKERS.some((m) => keys.includes(m))) {
        out.push({ path, obj: node });
      }
      keys.forEach((k) => personShaped(node[k], `${path}.${k}`, out));
    }
    return out;
  }

  it('finds the person-shaped records it is meant to police', () => {
    // A detector that matches nothing passes vacuously. Prove it recognises one.
    const found = personShaped(
      { roster: { agents: [{ name: 'X', title: 'Y', bio: 'Z' }] } },
      'fixture',
    );
    expect(found).toHaveLength(1);
  });

  it('does NOT mistake a dish or an event for a person', () => {
    const found = personShaped(
      { menu: { items: [{ name: 'House Favorite', price: '9' }] }, events: [{ name: 'Weekly gathering' }] },
      'fixture',
    );
    expect(found).toHaveLength(0);
  });

  it('ships no invented person in any block default', () => {
    const found = personShaped(DEFAULT_BLOCK_CONTENT, 'DEFAULT_BLOCK_CONTENT');
    const named = found.filter((f) => String(f.obj.name ?? '').trim());
    expect(
      named.map((f) => `${f.path}.name = ${JSON.stringify(f.obj.name)}`),
    ).toEqual([]);
  });

  it('specifically ships no agent roster', () => {
    // The exact regression: three colleagues who do not exist.
    const agents = (DEFAULT_BLOCK_CONTENT as any).agent_roster?.agents ?? [];
    expect(agents).toHaveLength(0);
    const src = JSON.stringify(DEFAULT_BLOCK_CONTENT);
    for (const ghost of ['Jordan Avery', 'Priya Nair', 'Marcus Bellamy']) {
      expect(src).not.toContain(ghost);
    }
  });
});
