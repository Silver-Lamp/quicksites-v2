import { voiceSourcesFor } from '../voiceSources';

const base = {
  meta: {
    business_name: 'Enjoy Teriyaki',
    contact: { city: 'Renton', state: 'WA', address: '1222 Bronson Way N #135' },
  },
};

describe('voiceSourcesFor', () => {
  it('returns nothing when we do not even know the name', () => {
    expect(voiceSourcesFor({ meta: { contact: { city: 'Renton' } } })).toEqual([]);
    expect(voiceSourcesFor(null)).toEqual([]);
  });

  // ⚠️ THE RULE THIS FILE EXISTS FOR. `yelp.com/biz/enjoy-teriyaki` is trivial to construct and
  // about as likely to be a different business — and an operator would then read a stranger's
  // reviews and write "their voice" from them.
  it('never fabricates a profile URL — social links are searches', () => {
    const out = voiceSourcesFor(base);
    const yelp = out.find((s) => s.label === 'Yelp')!;
    const fb = out.find((s) => s.label === 'Facebook')!;
    expect(yelp.href).toContain('/search?');
    expect(yelp.href).not.toMatch(/yelp\.com\/biz\//);
    expect(fb.href).toContain('/search/');
    expect(fb.kind).toBe('search');
  });

  it('labels every non-identifier link as a search, so the UI can say so', () => {
    const out = voiceSourcesFor(base);
    for (const s of out.filter((x) => x.label !== 'Google listing' && x.label !== 'Their site')) {
      expect(s.kind).toBe('search');
    }
  });

  it('uses the stored place id for an exact listing link when we kept one', () => {
    const out = voiceSourcesFor({
      meta: { ...base.meta, source_place_id: 'ChIJJxztMO5pkFQRcKAwipQGews' },
    });
    const g = out.find((s) => s.label === 'Google listing')!;
    expect(g.kind).toBe('exact');
    expect(g.href).toContain('place_id:ChIJJxztMO5pkFQRcKAwipQGews');
  });

  it('falls back to a maps SEARCH, honestly labelled, when there is no place id', () => {
    const g = voiceSourcesFor(base).find((s) => s.label === 'Google listing')!;
    expect(g.kind).toBe('search');
    expect(g.href).toContain('maps/search');
    expect(g.href).toContain('Enjoy%20Teriyaki');
  });

  it('encodes the query rather than concatenating it into a broken URL', () => {
    const g = voiceSourcesFor({ meta: { business_name: "Joe's Bar & Grill", contact: { city: 'Kent' } } })
      .find((s) => s.label === 'Reviews')!;
    // ⚠️ `&` is the one that matters — unencoded it would truncate the query at "Joe's Bar".
    // An apostrophe is left as-is by encodeURIComponent and is valid in a query string; my first
    // version of this test asserted %27 and was wrong about the encoder, not about the code.
    expect(g.href).not.toContain(' ');
    expect(g.href).toContain('%26');
    expect(g.href).toContain("Joe's");
  });

  // These are no-website businesses by construction — an always-present dead link would read as
  // breakage rather than absence.
  it('omits "Their site" unless one is actually known', () => {
    expect(voiceSourcesFor(base).some((s) => s.label === 'Their site')).toBe(false);
    const withSite = voiceSourcesFor({ meta: { ...base.meta, source_url: 'https://enjoyteriyaki.example' } });
    expect(withSite.find((s) => s.label === 'Their site')?.kind).toBe('exact');
  });

  it('puts reviews above social — customers name dishes the way locals say them', () => {
    const labels = voiceSourcesFor(base).map((s) => s.label);
    expect(labels.indexOf('Reviews')).toBeLessThan(labels.indexOf('Facebook'));
  });
});
