/**
 * @jest-environment node
 */
import {
  MIN_IMPRESSIONS,
  defaultWindow,
  isSelfReferential,
  parseQueryRows,
  pickStrikingDistance,
  summariseQueries,
} from '@/lib/gsc/queryHarvest';

const row = (query: string, impressions: number, position: number, clicks = 0) => ({
  keys: [query],
  clicks,
  impressions,
  ctr: impressions ? clicks / impressions : 0,
  position,
});

describe('parseQueryRows', () => {
  it('reads Google rows and drops anything malformed rather than guessing', () => {
    const parsed = parseQueryRows([
      row('tow truck bonney lake', 40, 12.3, 2),
      { keys: [], clicks: 5, impressions: 5, position: 1 },
      { clicks: 1 },
      null,
    ]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toEqual({ query: 'tow truck bonney lake', clicks: 2, impressions: 40, ctr: 0.05, position: 12.3 });
  });

  it('is empty for a non-array (an API error body must not read as "no demand")', () => {
    expect(parseQueryRows(undefined)).toEqual([]);
    expect(parseQueryRows({ error: 'quota' })).toEqual([]);
  });
});

describe('striking distance', () => {
  const rows = parseQueryRows([
    row('dome kit prices', 300, 14.2),       // the find
    row('already winning', 500, 3.1, 90),    // page 1 — not a gap
    row('way out there', 200, 61.0),         // not in the running
    row('tiny sample', 3, 18.0),             // noise
  ]);

  it('is page 2–4 with enough impressions to mean something', () => {
    expect(pickStrikingDistance(rows).map((r) => r.query)).toEqual(['dome kit prices']);
  });

  it('a 3-impression average is noise, not a rank', () => {
    expect(MIN_IMPRESSIONS).toBeGreaterThan(3);
    const loosened = pickStrikingDistance(rows, { minImpressions: 1 });
    expect(loosened.map((r) => r.query)).toContain('tiny sample');
  });

  it('sorts by impressions — most demand we are closest to, first', () => {
    const many = parseQueryRows([row('small', 30, 20), row('big', 400, 20), row('mid', 90, 20)]);
    expect(pickStrikingDistance(many).map((r) => r.query)).toEqual(['big', 'mid', 'small']);
  });
});

describe('self-referential queries', () => {
  it('a domain ranking for its own name proves nothing about winnable demand', () => {
    expect(isSelfReferential('bonney lake towing', 'https://www.bonneylake-towing.com/')).toBe(true);
    expect(isSelfReferential('bonneylaketowing', 'sc-domain:bonneylake-towing.com')).toBe(true);
    expect(isSelfReferential('flatbed tow truck cost', 'https://www.bonneylake-towing.com/')).toBe(false);
  });
});

describe('summariseQueries', () => {
  it('separates measurable rows from the long tail, and excludes self-lookups from the gap', () => {
    const rows = parseQueryRows([
      row('dome kit prices', 300, 14.2),
      row('bonney lake towing', 120, 55.0),  // self-referential → not an unserved gap
      row('emergency winch out', 80, 52.0),  // a real gap
      row('one impression', 1, 9.0),
    ]);
    const s = summariseQueries(rows, 'https://www.bonneylake-towing.com/');
    expect(s.queries).toBe(4);
    expect(s.measurable).toBe(3);
    expect(s.strikingDistance).toBe(1);
    expect(s.outOfRunning).toBe(1);
  });
});

describe('defaultWindow', () => {
  it('ends 3 days back because GSC data lags, and spans 28 days', () => {
    const w = defaultWindow(new Date('2026-09-22T12:00:00Z'));
    expect(w.endDate).toBe('2026-09-19');
    expect(w.startDate).toBe('2026-08-22');
  });
});

describe('fleet scope — the exclusion is on the page, never the query', () => {
  const { isNonCommercialPage, fleetRows, whyExcluded } = require('@/lib/gsc/fleetScope') as typeof import('@/lib/gsc/fleetScope');

  it('excludes the personal page and anything under it', () => {
    expect(isNonCommercialPage('https://www.quicksites.ai/sites/sandon')).toBe(true);
    expect(isNonCommercialPage('https://www.quicksites.ai/sites/sandon/')).toBe(true);
    expect(isNonCommercialPage('https://www.quicksites.ai/sites/sandon/resume')).toBe(true);
    expect(whyExcluded('https://www.quicksites.ai/sites/sandon')).toMatch(/Personal page/);
  });

  it('keeps commercial pages, including ones whose path merely starts similarly', () => {
    expect(isNonCommercialPage('https://www.quicksites.ai/sites/sandon-towing')).toBe(false);
    expect(isNonCommercialPage('https://www.quicksites.ai/pricing')).toBe(false);
    expect(isNonCommercialPage(null)).toBe(false); // a row with no page is kept, never guessed at
  });

  it('reports what it dropped — an invisible exclusion is the bug it exists to fix', () => {
    const { kept, excluded } = fleetRows([
      { page: 'https://www.quicksites.ai/sites/sandon' },
      { page: 'https://www.quicksites.ai/pricing' },
    ]);
    expect(kept).toHaveLength(1);
    expect(excluded).toHaveLength(1);
  });
});

describe('parseQueryRows with the page dimension', () => {
  it('reads keys as [query, page] when both were requested', () => {
    const parsed = parseQueryRows([
      { keys: ['dome kits', 'https://x.test/a'], clicks: 1, impressions: 20, ctr: 0.05, position: 12 },
    ]);
    expect(parsed[0]).toMatchObject({ query: 'dome kits', page: 'https://x.test/a' });
  });

  it('omits page when only [query] was requested', () => {
    const parsed = parseQueryRows([{ keys: ['dome kits'], clicks: 1, impressions: 20, ctr: 0.05, position: 12 }]);
    expect(parsed[0].page).toBeUndefined();
  });
});

describe('fleet scope covers all three personal pages, not just ours', () => {
  const { isNonCommercialPage, whyExcluded } = require('@/lib/gsc/fleetScope') as typeof import('@/lib/gsc/fleetScope');

  // Enumerating properties (rather than iterating one row per domain) brought HiveJournal's and
  // the personal domain's pages into our aggregates at once. Excluding one and missing the others
  // is worse than excluding none: the number looks cleaned.
  it('excludes the page on every property it appears on', () => {
    expect(isNonCommercialPage('https://www.quicksites.ai/sites/sandon')).toBe(true);
    expect(isNonCommercialPage('https://www.hivejournal.com/sandon-jurowski')).toBe(true);
    expect(isNonCommercialPage('https://sandonjurowski.com/')).toBe(true);
    expect(isNonCommercialPage('https://sandonjurowski.com/anything')).toBe(true);
  });

  it('gives a reason for a host-matched exclusion too', () => {
    expect(whyExcluded('https://sandonjurowski.com/')).toMatch(/exact-match domain/i);
    expect(whyExcluded('https://www.hivejournal.com/sandon-jurowski')).toMatch(/3,057/);
  });

  it('still keeps the commercial pages of those same properties', () => {
    expect(isNonCommercialPage('https://www.hivejournal.com/pricing')).toBe(false);
    expect(isNonCommercialPage('https://www.hivejournal.com/sandon-jurowski-fan-club')).toBe(false);
    expect(isNonCommercialPage('https://www.quicksites.ai/pricing')).toBe(false);
  });
});
