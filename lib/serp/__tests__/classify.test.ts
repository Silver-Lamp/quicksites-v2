/**
 * @jest-environment node
 */
import { classifyDomain, readSerp, tally } from '@/lib/serp/classify';
import { collapseLocalPack, mapItems } from '@/lib/serp/dataforseo';
import type { SerpElement, SerpSnapshot } from '@/lib/serp/types';

const snap = (elements: SerpElement[]): SerpSnapshot => ({
  query: 'q',
  location: 'Austin,Texas,United States',
  fetchedAt: '2026-09-22T00:00:00.000Z',
  elements,
});

describe('the towing shape must read as skip', () => {
  // The control: position 10.9, 69 impressions, zero clicks. If this ever passes, the tool lies.
  it('full pack + ads + a buried organic result', () => {
    const r = readSerp(
      snap([
        { kind: 'paid', rank: 1 },
        { kind: 'paid', rank: 2 },
        { kind: 'local_pack', rank: 3, entries: 3 },
        { kind: 'people_also_ask', rank: 4 },
        { kind: 'organic', rank: 5, domain: 'yelp.com' },
      ]),
    );
    expect(r.packSize).toBe(3);
    expect(r.adCount).toBe(2);
    expect(r.blocksAbove).toBe(4);
    expect(r.verdict).toBe('skip');
    expect(r.reason).toMatch(/towing shape/);
  });
});

describe('the winnable shapes', () => {
  it('a starved pack with a directory first is the best case', () => {
    const r = readSerp(
      snap([
        { kind: 'local_pack', rank: 1, entries: 1 },
        { kind: 'organic', rank: 2, domain: 'www.Yelp.com' },
      ]),
    );
    expect(r.verdict).toBe('best');
    expect(r.firstOrganicKind).toBe('directory');
    expect(r.reason).toMatch(/1 business\b/);
  });

  it('no pack at all, a business site first → good', () => {
    const r = readSerp(snap([{ kind: 'organic', rank: 1, domain: 'smokymountaintreehouses.com' }]));
    expect(r.packSize).toBe(0);
    expect(r.verdict).toBe('good');
  });

  it('a forum first with a thin pack means the good answer is unpublished', () => {
    const r = readSerp(
      snap([
        { kind: 'local_pack', rank: 1, entries: 2 },
        { kind: 'organic', rank: 2, domain: 'reddit.com' },
      ]),
    );
    expect(r.verdict).toBe('best');
    expect(r.reason).toMatch(/unpublished/);
  });

  // ⚠️ THIS TEST ASSERTED `mixed` UNTIL A REAL RUN DISAGREED. Every full-pack query in the
  // 2026-09-22 calibration had 1–2 blocks above organic, including the towing control we know
  // loses — so block count does not discriminate and pack size does.
  it('a full pack is skip even with organic right beneath it', () => {
    const r = readSerp(
      snap([
        { kind: 'local_pack', rank: 1, entries: 3 },
        { kind: 'organic', rank: 2, domain: 'example.com' },
      ]),
    );
    expect(r.blocksAbove).toBe(1);
    expect(r.verdict).toBe('skip');
    expect(tally([r]).green).toBe(0);
  });

  it('a full pack outranks the directory rule — order matters', () => {
    // The towing control is exactly this: a full pack with Yelp at #1. Checked in the other
    // order it would read `best`, which is how the first model got the control wrong.
    const r = readSerp(
      snap([
        { kind: 'local_pack', rank: 1, entries: 3 },
        { kind: 'organic', rank: 2, domain: 'yelp.com' },
      ]),
    );
    expect(r.firstOrganicKind).toBe('directory');
    expect(r.verdict).toBe('skip');
  });

  it('a thin pack under a crowded page is demoted, not green', () => {
    const r = readSerp(
      snap([
        { kind: 'ai_overview', rank: 1 },
        { kind: 'people_also_ask', rank: 2 },
        { kind: 'video', rank: 3 },
        { kind: 'images', rank: 4 },
        { kind: 'organic', rank: 5, domain: 'example.com' },
      ]),
    );
    expect(r.packSize).toBe(0);
    expect(r.verdict).toBe('mixed');
  });

  it('a page with no organic result at all is a skip, not a crash', () => {
    const r = readSerp(snap([{ kind: 'local_pack', rank: 1, entries: 3 }]));
    expect(r.verdict).toBe('skip');
    expect(r.firstOrganicRank).toBeNull();
  });
});

describe('classifyDomain refuses to guess', () => {
  it('knows directories, forums, retail — and says unknown for a business site', () => {
    expect(classifyDomain('www.angi.com')).toBe('directory');
    expect(classifyDomain('old.reddit.com')).toBe('forum');
    expect(classifyDomain('amazon.com')).toBe('retail');
    // A hostname cannot tell one carpenter from a national chain. Unknown keeps it in review.
    expect(classifyDomain('smokymountaintreehouses.com')).toBe('unknown');
    expect(classifyDomain(undefined)).toBe('unknown');
  });
});

describe('local pack siblings are collapsed', () => {
  // Uncollapsed, three siblings read as 3 blocks above organic AND a pack of 1 — which flips a
  // skip into a best case. Both halves wrong, in the direction that spends money.
  it('consecutive local_pack items become one block with the right entry count', () => {
    const collapsed = collapseLocalPack([
      { kind: 'local_pack', rank: 1 },
      { kind: 'local_pack', rank: 2 },
      { kind: 'local_pack', rank: 3 },
      { kind: 'organic', rank: 4, domain: 'yelp.com' },
    ]);
    expect(collapsed).toHaveLength(2);
    expect(collapsed[0]).toMatchObject({ kind: 'local_pack', entries: 3 });
    const r = readSerp(snap(collapsed));
    // The load-bearing number: uncollapsed this reads as a pack of 1, which would call a full
    // pack "best case". A bare full pack with organic right after is `mixed` (the worksheet's
    // "visible without scrolling" row) — it takes ads or a PAA box on top to make it the
    // towing shape, which the towing test above covers.
    expect(r.packSize).toBe(3);
    expect(r.verdict).toBe('skip');
  });

  it('leaves a nested-items pack alone', () => {
    const collapsed = collapseLocalPack([{ kind: 'local_pack', rank: 1, entries: 3 }]);
    expect(collapsed).toEqual([{ kind: 'local_pack', rank: 1, entries: 3 }]);
  });
});

describe('mapItems', () => {
  it('reads types and ranks, derives the host, counts pack entries', () => {
    const els = mapItems([
      { type: 'paid', rank_absolute: 1 },
      { type: 'local_pack', rank_absolute: 2, items: [{}, {}] },
      { type: 'organic', rank_absolute: 3, url: 'https://www.Example.com/a' },
      { type: 'some_new_google_thing', rank_absolute: 4 },
      { type: 'organic' },
    ]);
    expect(els).toHaveLength(4);
    expect(els[1]).toMatchObject({ kind: 'local_pack', entries: 2 });
    expect(els[2]).toMatchObject({ kind: 'organic', domain: 'example.com' });
    // An unrecognised element still counts as something above organic.
    expect(els[3].kind).toBe('other');
  });
});

describe('tally follows the worksheet', () => {
  // Carries a query, because tally() now reads one to spot the control. A fixture missing the
  // field is how the first version of this looked fine and threw.
  let n = 0;
  const r = (verdict: 'best' | 'good' | 'mixed' | 'skip') =>
    ({ verdict, query: `candidate ${++n}` }) as unknown as ReturnType<typeof readSerp>;

  it('7 of 10 green is a cohort; 3 of 10 says fix the scoring', () => {
    expect(tally([r('best'), r('best'), r('good'), r('good'), r('good'), r('good'), r('good'), r('skip'), r('skip'), r('mixed')]).recommendation).toMatch(/Real cohort/);
    expect(tally([r('best'), r('good'), r('good'), r('skip'), r('skip'), r('skip'), r('skip'), r('skip'), r('skip'), r('mixed')]).recommendation).toMatch(/did not hold/);
  });

  it('nothing measured is said plainly, never as a zero score', () => {
    expect(tally([]).recommendation).toMatch(/Nothing measured/);
  });
});

describe('⚠️ the control is never counted as a candidate', () => {
  const { tally: t, readHumanSerp } = require('@/lib/serp/classify') as typeof import('@/lib/serp/classify');
  const row = (query: string, packSize: number) =>
    readHumanSerp({ query, location: 'L', packSize, firstOrganicKind: 'unknown' });

  // The 2026-09-23 run read 6/9 = 67% ("split — don't buy") when the real figure was 6/8 = 75%
  // ("real cohort — price the domains"). The control scores `skip` by design, so counting it
  // drags every run down by one row.
  it('a run scores the same with or without the control in it', () => {
    const candidates = [row('a', 0), row('b', 0), row('c', 0), row('d', 3)];
    const withControl = t([...candidates, row('towing service near me', 3)]);
    const without = t(candidates);
    expect(withControl.total).toBe(without.total);
    expect(withControl.green).toBe(without.green);
    expect(withControl.recommendation).toBe(without.recommendation);
  });

  it('the exact run that exposed it now reads "real cohort"', () => {
    const readings = [
      row('1', 0), row('2', 0), row('3', 3), row('4', 0), row('5', 2),
      row('7', 0), row('8', 0), row('10', 3),
      row('towing service near me', 3),
    ];
    const r = t(readings);
    expect(r.total).toBe(8);
    expect(r.green).toBe(6);
    expect(r.recommendation).toMatch(/Real cohort/);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(t([row('  Towing Service Near Me  ', 3)]).total).toBe(0);
  });
});

describe('the console preview and the server agree by construction', () => {
  const { readHumanSerp: rh } = require('@/lib/serp/classify') as typeof import('@/lib/serp/classify');

  // The console previews what a save will record using this same function, so a preview can
  // never promise something the stored row does not deliver. The bug it replaced was worse than
  // a mismatch: the row rendered YESTERDAY'S saved verdict under today's selections, so a
  // re-done control showed "BEST — pack has 0" while the form read 3 + directory.
  it('the exact case that confused the operator now previews as skip', () => {
    const r = rh({
      query: 'towing service near me',
      location: 'Bonney Lake,Washington,United States',
      packSize: 3,
      firstOrganicKind: 'directory',
    });
    expect(r.verdict).toBe('skip');
    expect(r.reason).toMatch(/Full 3-business pack/);
  });

  it('and the stale answer it used to show is a different verdict entirely', () => {
    const stale = rh({
      query: 'towing service near me',
      location: 'Bonney Lake,Washington,United States',
      packSize: 0,
      firstOrganicKind: 'directory',
    });
    expect(stale.verdict).toBe('best');
    expect(stale.verdict).not.toBe('skip');
  });
});
