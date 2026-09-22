/**
 * @jest-environment node
 */
import { buildWorklist, nicheWorklist, summarise, worksheetWorklist } from '@/lib/serp/worklist';
import { readHumanSerp, readHumanSerpNoOrganic, compareReadings, readSerp } from '@/lib/serp/classify';
import type { SerpCheck } from '@/lib/serp/checkSets';

describe('the control comes first', () => {
  // Buried at the end it gets answered by a tired person, and it is the one row whose job is to
  // catch a broken reading.
  it('is step 1 and is flagged', () => {
    const w = worksheetWorklist();
    expect(w[0].isControl).toBe(true);
    expect(w[0].query).toBe('towing service near me');
    expect(w.filter((s) => s.isControl)).toHaveLength(1);
  });

  it('is appended to a niche run that would not otherwise have one', () => {
    const w = nicheWorklist('treehouse', ['treehouse builder'], ['Austin']);
    expect(w[0].isControl).toBe(true);
    expect(w.length).toBeGreaterThan(1);
  });

  it('numbers every step and builds a search url', () => {
    const w = worksheetWorklist();
    expect(w.map((s) => s.index)).toEqual(w.map((_, i) => i + 1));
    expect(w[1].searchUrl).toMatch(/^https:\/\/www\.google\.com\/search\?q=/);
  });
});

describe('a human reading uses the same rule as the machine', () => {
  const q = 'treehouse builder austin tx';
  const loc = 'Austin,Texas,United States';

  it('a full pack is skip for a person too', () => {
    expect(readHumanSerp({ query: q, location: loc, packSize: 3, firstOrganicKind: 'directory' }).verdict).toBe('skip');
  });

  it('a thin pack with a forum first is best', () => {
    expect(readHumanSerp({ query: q, location: loc, packSize: 0, firstOrganicKind: 'forum' }).verdict).toBe('best');
  });

  it('agrees with the machine on the same inputs', () => {
    const human = readHumanSerp({ query: q, location: loc, packSize: 0, firstOrganicKind: 'directory' });
    const machine = readSerp({
      query: q, location: loc, fetchedAt: '', elements: [{ kind: 'organic', rank: 1, domain: 'yelp.com' }],
    });
    expect(compareReadings(human, machine).verdictMatch).toBe(true);
  });

  it('"no blue link at all" is its own case, not a missing answer', () => {
    const r = readHumanSerpNoOrganic(q, loc, 3);
    expect(r.firstOrganicRank).toBeNull();
    expect(r.verdict).toBe('skip');
  });
});

describe('a run whose control failed gets no recommendation', () => {
  const check = (nicheKey: string | null, query: string): SerpCheck => ({ nicheKey, query, location: 'L' });
  const reading = (packSize: number, kind: 'directory' | 'unknown' = 'unknown') =>
    readHumanSerp({ query: 'q', location: 'L', packSize, firstOrganicKind: kind });

  it('says so plainly instead of tallying anyway', () => {
    const s = summarise(
      [
        { check: check('towing', 'towing service near me'), human: reading(0) }, // wrongly 'good'
        { check: check('treehouse', 'a'), human: reading(0) },
      ],
      2,
    );
    expect(s.controlOk).toBe(false);
    expect(s.recommendation).toMatch(/cannot be read/i);
    expect(s.recommendation).not.toMatch(/cohort/i);
  });

  it('tallies normally when the control behaved', () => {
    const s = summarise(
      [
        { check: check('towing', 'towing service near me'), human: reading(3) },
        { check: check('treehouse', 'a'), human: reading(0) },
        { check: check('treehouse', 'b'), human: reading(0) },
        { check: check('treehouse', 'c'), human: reading(0) },
      ],
      4,
    );
    expect(s.controlOk).toBe(true);
    expect(s.green).toBe(3);
    expect(s.recommendation).toMatch(/Real cohort/);
  });

  it('excludes the control from the green tally — it is a check, not a candidate', () => {
    const s = summarise([{ check: check('towing', 'towing service near me'), human: reading(3) }], 1);
    expect(s.green).toBe(0);
  });

  it('reports disagreements with the machine', () => {
    const machine = readHumanSerp({ query: 'q', location: 'L', packSize: 3, firstOrganicKind: 'unknown' });
    const s = summarise([{ check: check('treehouse', 'a'), human: reading(0), machine }], 1);
    expect(s.disagreements).toHaveLength(1);
    expect(s.disagreements[0]).toMatchObject({ human: 'good', machine: 'skip' });
  });
});

describe('progress is honest mid-run', () => {
  it('reports done/total rather than a verdict', () => {
    const s = summarise([{ check: { nicheKey: 'x', query: 'a', location: 'L' }, human: readHumanSerp({ query: 'a', location: 'L', packSize: 0, firstOrganicKind: 'unknown' }) }], 10);
    expect(s.recommendation).toBe('1 of 10 done.');
  });
});

describe('only "near me" rows need a location override', () => {
  const { CITY_COORDS } = require('@/lib/serp/worklist') as typeof import('@/lib/serp/worklist');

  // ⚠️ The first version told people to set a location on all ten rows, two-thirds of which name
  // the city in the query. A setup step that is unnecessary most of the time gets skipped on the
  // rows where it IS load-bearing — and a "near me" search run from the wrong city measures the
  // wrong market while looking exactly like a measurement of the right one.
  it('flags near-me rows and leaves city-qualified ones alone', () => {
    const w = worksheetWorklist();
    const nearMe = w.filter((s) => /near me/i.test(s.query));
    const cityQualified = w.filter((s) => !/near me/i.test(s.query));
    expect(nearMe.length).toBeGreaterThan(0);
    expect(cityQualified.length).toBeGreaterThan(0);
    for (const s of nearMe) expect(s.needsLocationOverride).toBe(true);
    for (const s of cityQualified) expect(s.needsLocationOverride).toBe(false);
  });

  it('gives coordinates for every city a near-me row runs in', () => {
    for (const s of worksheetWorklist().filter((x) => x.needsLocationOverride)) {
      expect(s.coords).toMatch(/^-?\d+\.\d+, -?\d+\.\d+$/);
    }
  });

  it('every LOC city has coordinates — a missing one silently drops the help', () => {
    const { LOC } = require('@/lib/serp/checkSets') as typeof import('@/lib/serp/checkSets');
    for (const city of Object.keys(LOC)) expect(CITY_COORDS[city]).toBeTruthy();
  });
});

describe('rows are grouped by city', () => {
  // A Sensors override survives retyping a query in the same tab but not a change of city, so
  // interleaving cities means one trip through the DevTools panel per ROW instead of per city.
  it('never returns to a city once it has left it', () => {
    const w = nicheWorklist('treehouse', ['treehouse builder'], ['Austin', 'Denver', 'Seattle']);
    const seen: string[] = [];
    for (const s of w.slice(1)) {
      if (seen[seen.length - 1] !== s.location) seen.push(s.location);
    }
    expect(new Set(seen).size).toBe(seen.length);
  });

  it('keeps the control first even though it has its own city', () => {
    const w = nicheWorklist('treehouse', ['treehouse builder'], ['Austin', 'Denver']);
    expect(w[0].isControl).toBe(true);
  });

  it('every near-me row carries a verified timezone id', () => {
    const { CITY_LOCALES } = require('@/lib/serp/worklist') as typeof import('@/lib/serp/worklist');
    for (const s of worksheetWorklist().filter((x) => x.needsLocationOverride)) {
      expect(s.timezoneId).toMatch(/^America\/[A-Za-z_]+$/);
    }
    // The three people get wrong: Phoenix and Boise have their own ids, and Portland is Maine.
    expect(CITY_LOCALES.phoenix.timezoneId).toBe('America/Phoenix');
    expect(CITY_LOCALES.boise.timezoneId).toBe('America/Boise');
    expect(CITY_LOCALES.portland.timezoneId).toBe('America/New_York');
  });
});
