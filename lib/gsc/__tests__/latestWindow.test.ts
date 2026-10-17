// lib/gsc/__tests__/latestWindow.test.ts — a daily capture of a 28-day window is summed ONCE.
import fs from 'node:fs';
import path from 'node:path';
import { latestWindowFor, latestWindowTotals } from '@/lib/gsc/latestWindow';

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8');

describe('latestWindowTotals', () => {
  const rows = [
    // three daily captures of the same two queries — the old sum would read 3× the truth
    { domain: 'https://www.richland-towing.com/', end_date: '2026-10-11', impressions: 40, clicks: 2 },
    { domain: 'https://www.richland-towing.com/', end_date: '2026-10-11', impressions: 31, clicks: 2 },
    { domain: 'https://www.richland-towing.com/', end_date: '2026-10-12', impressions: 40, clicks: 2 },
    { domain: 'https://www.richland-towing.com/', end_date: '2026-10-12', impressions: 30, clicks: 2 },
    { domain: 'sc-domain:richland-towing.com', end_date: '2026-10-13', impressions: 40, clicks: 2 },
    { domain: 'sc-domain:richland-towing.com', end_date: '2026-10-13', impressions: 24, clicks: 2 },
    { domain: 'https://oak-harbor-towing.com/', end_date: '2026-10-13', impressions: 5, clicks: 0 },
  ];
  it('sums only the latest capture per host, across property spellings', () => {
    const t = latestWindowTotals(rows);
    expect(t.get('richland-towing.com')).toEqual({ impressions: 64, clicks: 4, endDate: '2026-10-13', queries: 2 });
    expect(t.get('oak-harbor-towing.com')).toEqual({ impressions: 5, clicks: 0, endDate: '2026-10-13', queries: 1 });
    expect(latestWindowFor(rows, 'www.richland-towing.com')!.impressions).toBe(64);
    expect(latestWindowFor(rows, 'nothing.com')).toBeNull();
  });
});

describe('every reader of the harvest goes through it (source guards)', () => {
  for (const p of ['lib/ppl/corpus.ts', 'lib/ppl/forwardSuggestions.ts', 'lib/ppl/callAnalysis.ts']) {
    it(p, () => {
      const src = read(p);
      expect(src).toMatch(/latestWindow(Totals|For)\(/);
      // The old shape: a reduce/sum over impressions straight off the rows.
      expect(src).not.toMatch(/rows\.reduce\(\(n, r\) => n \+ \(r\.impressions/);
      expect(src).not.toMatch(/demand\.set\(key, \(demand\.get\(key\) \?\? 0\) \+ \(g\.impressions/);
    });
  }
});
