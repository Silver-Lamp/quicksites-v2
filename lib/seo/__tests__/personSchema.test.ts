import { buildPersonSchema, isPublishableProfileUrl, personSchemaEnabled, personIdentityFromTemplate } from '../personSchema';

describe('isPublishableProfileUrl — sameAs is a claim of identity', () => {
  it('accepts real profile URLs', () => {
    expect(isPublishableProfileUrl('https://github.com/jurowski')).toBe(true);
    expect(isPublishableProfileUrl('https://linkedin.com/in/jurowski')).toBe(true);
  });
  it('rejects anything that is not a public identity', () => {
    for (const bad of ['', 'github.com/x', 'javascript:alert(1)', 'http://localhost:3000', 'https://127.0.0.1', null, 42]) {
      expect(isPublishableProfileUrl(bad as any)).toBe(false);
    }
  });
});

describe('buildPersonSchema', () => {
  it('omits fields rather than emitting empty ones', () => {
    const s = buildPersonSchema({ name: 'Jane Doe', jobTitle: '  ', description: null, sameAs: [] })!;
    expect(s.name).toBe('Jane Doe');
    expect('jobTitle' in s).toBe(false);
    expect('sameAs' in s).toBe(false);   // an empty sameAs claims nothing and should not appear
  });

  it('keeps only owner-supplied, publishable profiles', () => {
    const s = buildPersonSchema({
      name: 'Jane Doe',
      sameAs: ['https://github.com/jane', 'not-a-url', 'http://localhost/x'],
    })!;
    expect(s.sameAs).toEqual(['https://github.com/jane']);
  });

  it('preserves the owner ordering and de-dupes', () => {
    const id = personIdentityFromTemplate({
      business_name: 'Jane Doe',
      meta: { links: [{ href: 'https://linkedin.com/in/jane' }, { href: 'https://github.com/jane' }, { href: 'https://linkedin.com/in/jane' }] },
    });
    expect(id?.sameAs).toEqual(['https://linkedin.com/in/jane', 'https://github.com/jane']);
  });

  it('returns null without a name — a Person with no name is not an entity', () => {
    expect(buildPersonSchema({ name: '   ' })).toBeNull();
  });
});

describe('personSchemaEnabled — only for sites that are about a person', () => {
  it('is on for personal and author sites', () => {
    expect(personSchemaEnabled({}, 'personal')).toBe(true);
    expect(personSchemaEnabled({}, 'author')).toBe(true);
  });
  it('is OFF for a business — a Person block on a restaurant says the restaurant is a human', () => {
    expect(personSchemaEnabled({}, 'paving')).toBe(false);
    expect(personSchemaEnabled({}, 'restaurant')).toBe(false);
  });
  it('respects an explicit owner override both ways', () => {
    expect(personSchemaEnabled({ meta: { person: { enabled: true } } }, 'paving')).toBe(true);
    expect(personSchemaEnabled({ meta: { person: { enabled: false } } }, 'personal')).toBe(false);
  });
});

describe('personIdentityFromTemplate — where the name actually lives', () => {
  // ⚠️ Regression: the schema shipped reading three of the four aliases, missing the one
  // `industryScaffold` writes — so it silently did not emit on the sites it was built for.
  it('finds the name at meta.business_name', () => {
    const id = personIdentityFromTemplate({ meta: { business_name: 'Sandon Jurowski' } });
    expect(id?.name).toBe('Sandon Jurowski');
  });

  it('finds the name at meta.siteTitle', () => {
    expect(personIdentityFromTemplate({ meta: { siteTitle: 'A Person' } })?.name).toBe('A Person');
  });

  it('reads an identity block stored at the top level, not only under meta', () => {
    const id = personIdentityFromTemplate({ identity: { person_name: 'Top Level' } });
    expect(id?.name).toBe('Top Level');
  });

  it('still returns null when there is no name to assert', () => {
    expect(personIdentityFromTemplate({ meta: {} })).toBeNull();
  });
});
