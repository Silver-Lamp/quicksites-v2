// lib/sales/__tests__/rateCard.test.ts
import {
  nextStepForRow,
  buildRateCardRow, buildRateCard, areaCodeMatchesState, PAGE_ONE,
} from '../rateCard';
import type { GscSite, SiteFacts } from '../rateCard';

const site = (host: string, queries: Array<[string, number, number]>, position = 12): GscSite => ({
  host, clicks: 0, impressions: queries.reduce((a, q) => a + q[2], 0), position,
  queries: queries.map(([query, pos, impressions]) => ({ query, position: pos, impressions, clicks: 0 })),
});
const facts = (over: Partial<SiteFacts> = {}): SiteFacts => ({
  host: 'graftontowing.com', city: 'Grafton', state: 'WI', phone: '2622282491',
  industryKey: 'towing' as any, ...over,
});

describe('qualification is the honesty control', () => {
  it('qualifies a domain holding page one for its own city+trade phrase', () => {
    const row = buildRateCardRow(site('graftontowing.com', [['grafton towing', 1.7, 7]]), facts());
    expect(row.qualifies).toBe(true);
    expect(row.proofQuery).toBe('grafton towing');
  });

  it('does NOT qualify on a generic trade query, however good the position', () => {
    // "towing near me" at position 1 is not proof that THIS city's searchers find them.
    const row = buildRateCardRow(site('bremerton-towing.com', [['flatbed towing near me', 1, 400]]), facts({
      host: 'bremerton-towing.com', city: 'Bremerton', state: 'WA', phone: '3605551212',
    }));
    expect(row.qualifies).toBe(false);
    expect(row.proofQuery).toBeNull();
  });

  it('does not qualify a city+trade query that sits off page one', () => {
    const row = buildRateCardRow(site('bonneylake-towing.com', [['bonney lake towing', 19.2, 123]]), facts({
      host: 'bonneylake-towing.com', city: 'Bonney Lake', state: 'WA', phone: '2533085429',
    }));
    expect(row.qualifies).toBe(false);
  });

  it('treats exactly PAGE_ONE as in, and just past it as out', () => {
    const inRow = buildRateCardRow(site('arab-towing.com', [['arab towing', PAGE_ONE, 5]]), facts({ host: 'arab-towing.com', city: 'Arab', state: 'AL', phone: '2565595273' }));
    const outRow = buildRateCardRow(site('arab-towing.com', [['arab towing', PAGE_ONE + 0.4, 5]]), facts({ host: 'arab-towing.com', city: 'Arab', state: 'AL', phone: '2565595273' }));
    expect(inRow.qualifies).toBe(true);
    expect(outRow.qualifies).toBe(false);
  });
});

describe('the proof phrase is chosen by appearances, not by best position', () => {
  it('prefers the phrase people actually search over the flattering one', () => {
    // The real graftontowing case: position 1.0 on 2 appearances vs 1.7 on 7.
    const row = buildRateCardRow(
      site('graftontowing.com', [['grafton towing service', 1.0, 2], ['grafton towing', 1.7, 7]]),
      facts()
    );
    expect(row.proofQuery).toBe('grafton towing');
    expect(row.proofPosition).toBe(1.7);
    expect(row.otherPageOneQueries).toContain('grafton towing service');
  });
});

describe('blockers stop a rep pitching something broken', () => {
  it('hard-stops a domain with no service area, even when it ranks', () => {
    const row = buildRateCardRow(
      site('pnw-exteriorcleaning.com', [['pnw exterior cleaning', 3.8, 13]]),
      facts({ host: 'pnw-exteriorcleaning.com', city: null, state: null, phone: null })
    );
    expect(row.qualifies).toBe(true);       // it really does rank
    expect(row.pitchable).toBe(false);      // and must still not be pitched
    expect(row.blockers.map((b) => b.id)).toEqual(expect.arrayContaining(['no-service-area', 'no-phone']));
  });

  it('warns on an area code that does not belong to the state', () => {
    const row = buildRateCardRow(site('richland-towing.com', [['richland towing', 6.8, 15]]), facts({
      host: 'richland-towing.com', city: 'Richland', state: 'WA', phone: '3607715688',
    }));
    // 360 IS a Washington code, so this must NOT warn — the check is per-state, not per-city.
    expect(row.blockers.find((b) => b.id === 'area-code-mismatch')).toBeUndefined();
    const wrong = buildRateCardRow(site('richland-towing.com', [['richland towing', 6.8, 15]]), facts({
      host: 'richland-towing.com', city: 'Richland', state: 'WA', phone: '2125551212',
    }));
    expect(wrong.blockers.find((b) => b.id === 'area-code-mismatch')).toBeDefined();
    expect(wrong.pitchable).toBe(true); // a warning, not a stop
  });

  it('flags thin volume so the rep sells the name rather than the traffic', () => {
    const row = buildRateCardRow(site('covingtontow.com', [['covington towing', 4.8, 5]]), facts({
      host: 'covingtontow.com', city: 'Covington', state: 'WA', phone: '2534390408',
    }));
    expect(row.blockers.find((b) => b.id === 'thin-volume')).toBeDefined();
  });
});

describe('area-code check never approves what it cannot evaluate', () => {
  it('returns null (not checked) for a state it has no codes for', () => {
    // The failure mode this guards: an unknown state silently reading as "fine".
    expect(areaCodeMatchesState('2125551212', 'NY')).toBeNull();
    expect(areaCodeMatchesState(null, 'WA')).toBeNull();
    expect(areaCodeMatchesState('253', 'WA')).toBeNull();
  });
  it('gives a real verdict where it has the data', () => {
    expect(areaCodeMatchesState('2533085429', 'WA')).toBe(true);
    expect(areaCodeMatchesState('12533085429', 'WA')).toBe(true);
    expect(areaCodeMatchesState('2622282491', 'WA')).toBe(false);
  });
});

describe('pricing comes from config, never from this module', () => {
  it('reads the industry tier rather than a literal', () => {
    const towing = buildRateCardRow(site('arab-towing.com', [['arab towing', 3.9, 68]]), facts({ host: 'arab-towing.com', city: 'Arab', state: 'AL', industryKey: 'towing' as any }));
    const washing = buildRateCardRow(site('x-pressurewashing.com', [['x pressure washing', 4, 20]]), facts({ host: 'x-pressurewashing.com', city: 'X', state: 'WA', phone: '2535551212', industryKey: 'pressure_washing' as any }));
    expect(towing.fullCents).toBeGreaterThan(washing.fullCents); // premium vs mid
    expect(towing.lockedCents).toBeLessThan(towing.fullCents);   // founder rate is the discount
  });
});

describe('ordering puts the strongest proof first', () => {
  it('sorts qualifying domains ahead of the rest, by appearances', () => {
    const rows = buildRateCard(
      [
        site('covingtontow.com', [['covington towing', 4.8, 5]]),
        site('bonneylake-towing.com', [['bonney lake towing', 19.2, 123]]),
        site('arab-towing.com', [['arab towing', 3.9, 68]]),
      ],
      [
        facts({ host: 'covingtontow.com', city: 'Covington', state: 'WA', phone: '2534390408' }),
        facts({ host: 'bonneylake-towing.com', city: 'Bonney Lake', state: 'WA', phone: '2533085429' }),
        facts({ host: 'arab-towing.com', city: 'Arab', state: 'AL', phone: '2565595273' }),
      ]
    );
    expect(rows.map((r) => r.host)).toEqual(['arab-towing.com', 'covingtontow.com', 'bonneylake-towing.com']);
    expect(rows[2].qualifies).toBe(false);
  });
});

describe('a lookup failure must not wear the costume of a data problem', () => {
  // ⚠️ This shipped. When the site-records query failed, every field defaulted to empty and the
  // card reported "no city on the site", "no phone on the site" and the LOWEST price tier — for
  // arab-towing.com, which has a city, a state, a phone and is a $399 towing domain. Every word on
  // screen was wrong and none of it looked like an error.
  const noFacts = buildRateCardRow(site('arab-towing.com', [['arab towing', 3.9, 71]]), undefined);

  it('says the record could not be loaded, not that the site is missing fields', () => {
    expect(noFacts.factsFound).toBe(false);
    const ids = noFacts.blockers.map((b) => b.id);
    expect(ids).toEqual(['facts-unavailable']);
    expect(ids).not.toContain('no-service-area');
    expect(ids).not.toContain('no-phone');
  });

  it('admits the price is untrustworthy rather than quoting the bottom tier as fact', () => {
    expect(noFacts.blockers[0].label).toMatch(/not trustworthy/i);
    expect(noFacts.blockers[0].severity).toBe('stop');
    expect(noFacts.pitchable).toBe(false);
  });

  it('still reports the ranking, which came from Search Console and is unaffected', () => {
    // The GSC half of the row is independent of the template lookup — losing one must not
    // silently discard the other.
    expect(noFacts.qualifies).toBe(true);
    expect(noFacts.proofQuery).toBe('arab towing');
  });
});

describe('rows carry the ids the operator needs to act', () => {
  it('exposes the template id so the card can link to the editor', () => {
    const r = buildRateCardRow(site('arab-towing.com', [['arab towing', 3.9, 71]]), facts({ host: 'arab-towing.com', templateId: 'tpl-7' }));
    expect(r.templateId).toBe('tpl-7');
    expect(r.factsFound).toBe(true);
  });
});

describe('the next step is one thing, in the order the work has to happen', () => {
  const good = () => buildRateCardRow(site('arab-towing.com', [['arab towing', 3.9, 71]]), facts({ host: 'arab-towing.com', templateId: 'tpl-7' }));

  it('a broken lookup outranks everything — do not send anyone to fix a site that may be fine', () => {
    const r = buildRateCardRow(site('a.com', [['a towing', 4, 20]]), undefined);
    expect(nextStepForRow(r).label).toMatch(/reload/i);
  });

  it('a stop blocker comes before making it rentable, and links to the editor', () => {
    const r = buildRateCardRow(site('a.com', [['a towing', 4, 20]]), facts({ host: 'a.com', templateId: 'tpl-1', phone: null }));
    const step = nextStepForRow(r, { campaignId: null });
    expect(step.label).toMatch(/fix the site/i);
    expect(step.href).toBe('/admin/templates/tpl-1');
    expect(step.tone).toBe('blocked');
  });

  it('a clean domain that is not a campaign should be made rentable', () => {
    expect(nextStepForRow(good(), { campaignId: null }).label).toMatch(/rentable/i);
  });

  it('a campaign with nobody attached needs a sweep, not a postcard', () => {
    // The trap this encodes: adopting a domain feels like progress and changes nothing you can
    // mail. arab-towing had 2 prospects in the whole city.
    const step = nextStepForRow(good(), { campaignId: 'c-1', prospectCount: 0 });
    expect(step.label).toMatch(/find businesses/i);
    expect(step.href).toBe('/admin/growth?tab=prospects');
  });

  it('only offers the postcard once there is a cohort and the domain is clean', () => {
    const step = nextStepForRow(good(), { campaignId: 'c-1', prospectCount: 6 });
    expect(step.label).toMatch(/postcard/i);
    expect(step.href).toBe('/admin/prospects/poster/c-1');
    expect(step.why).toMatch(/6 prospects/);
  });
});
