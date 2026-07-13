/**
 * @jest-environment node
 */
// lib/prospects/__tests__/keywordVolume.test.ts

import {
  keywordForCandidate,
  applyKeywordVolume,
  keywordVolumeEnabled,
} from '@/lib/prospects/keywordVolume';
import { buildBuyList, type BuyCandidate } from '@/lib/prospects/buyList';

describe('keywordForCandidate', () => {
  it('builds a local keyword from city + industry service word', () => {
    expect(keywordForCandidate('Gallatin', 'towing')).toBe('gallatin towing');
    expect(keywordForCandidate('Renton', 'windshield_repair')).toBe('renton auto glass');
    expect(keywordForCandidate('Kent', 'roof_cleaning')).toBe('kent roofing');
  });
});

describe('keywordVolumeEnabled', () => {
  it('is off without the flag + creds', () => {
    const prev = { ...process.env };
    delete process.env.KEYWORD_VOLUME_ENABLED;
    expect(keywordVolumeEnabled()).toBe(false);
    process.env = prev;
  });
});

describe('applyKeywordVolume — pure re-rank', () => {
  const cands = (): BuyCandidate[] =>
    buildBuyList([
      { city: 'Alpha', region: 'WA', industry_key: 'towing', lead_tier: 'no_website' },
      { city: 'Beta', region: 'WA', industry_key: 'towing', lead_tier: 'no_website' },
    ]);

  it('leaves candidates unchanged when there is no volume data', () => {
    const list = cands();
    const out = applyKeywordVolume(list, {});
    expect(out.every((c) => c.searchVolume === null && c.volumeFactor === 1)).toBe(true);
  });

  it('boosts and re-ranks the higher-volume market', () => {
    const list = cands();
    const alpha = list.find((c) => c.city === 'Alpha')!;
    const beta = list.find((c) => c.city === 'Beta')!;
    // Give Beta much higher volume; both start with equal base score.
    const out = applyKeywordVolume(list, { [alpha.domain]: 10, [beta.domain]: 5000 });
    expect(out[0].city).toBe('Beta');
    expect(out[0].searchVolume).toBe(5000);
    expect(out[0].volumeFactor).toBeGreaterThan(out.find((c) => c.city === 'Alpha')!.volumeFactor);
  });

  it('is idempotent — applying twice yields the same factor + score', () => {
    const list = cands();
    const once = applyKeywordVolume(list, { [list[0].domain]: 800 });
    const twice = applyKeywordVolume(once, { [list[0].domain]: 800 });
    const a = once.find((c) => c.domain === list[0].domain)!;
    const b = twice.find((c) => c.domain === list[0].domain)!;
    expect(b.volumeFactor).toBeCloseTo(a.volumeFactor);
    expect(b.score).toBeCloseTo(a.score);
  });
});
