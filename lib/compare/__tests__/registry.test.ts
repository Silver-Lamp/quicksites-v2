/**
 * @jest-environment node
 */
// Pure staleness/gap audit for the compare registry — the load-bearing logic behind the
// quarterly compare-registry-audit cron. `nowMs` is injected so these are deterministic.

import { auditCompareRegistry, type CompareRegistryEntry } from '@/lib/compare/registry';

const base: CompareRegistryEntry = {
  key: 'website-builders',
  name: 'QuickSites vs website builders',
  status: 'live',
  clusterPath: '/compare',
  libFile: 'lib/compare/competitors.ts',
  competitors: ['wix', 'shopify'],
  pricesVerified: '2026-07-01',
};

const day = 86_400_000;
const at = (iso: string) => Date.parse(iso);

describe('auditCompareRegistry', () => {
  it('does not flag a live cluster verified within 90 days', () => {
    const findings = auditCompareRegistry([base], at('2026-08-15')); // ~45 days later
    expect(findings).toHaveLength(0);
  });

  it('flags a live cluster stale >90 days', () => {
    const findings = auditCompareRegistry([base], at('2026-07-01') + 100 * day);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: 'stale', key: 'website-builders', ageDays: 100 });
  });

  it('treats the 90-day boundary as stale (>=)', () => {
    expect(auditCompareRegistry([base], at('2026-07-01') + 90 * day)).toHaveLength(1);
    expect(auditCompareRegistry([base], at('2026-07-01') + 89 * day)).toHaveLength(0);
  });

  it('parses a lenient "Month Year" pricesVerified (V8 accepts "July 2026")', () => {
    // Date.parse('July 2026') → 2026-07-01, so within 90d it is NOT stale.
    expect(auditCompareRegistry([{ ...base, pricesVerified: 'July 2026' }], at('2026-07-10'))).toHaveLength(0);
  });

  it('flags a genuinely unparseable pricesVerified as stale (Infinity age)', () => {
    const findings = auditCompareRegistry([{ ...base, pricesVerified: 'sometime' }], at('2026-07-10'));
    expect(findings[0]).toMatchObject({ kind: 'stale', ageDays: Infinity });
  });

  it('flags a candidate (no cluster) as a gap, regardless of date', () => {
    const findings = auditCompareRegistry(
      [{ ...base, status: 'candidate', key: 'ai-builders', name: 'QuickSites vs AI builders' }],
      at('2026-07-02'),
    );
    expect(findings).toEqual([{ kind: 'gap', key: 'ai-builders', name: 'QuickSites vs AI builders', notes: undefined }]);
  });

  it('ignores skip entries', () => {
    expect(auditCompareRegistry([{ ...base, status: 'skip' }], at('2027-01-01'))).toHaveLength(0);
  });

  it('never mutates or re-fetches — pure over the given registry + clock', () => {
    const reg = [base, { ...base, key: 'k2', pricesVerified: '2025-01-01' }];
    const findings = auditCompareRegistry(reg, at('2026-07-10'));
    // only the very old one is stale
    expect(findings.map((f) => f.key)).toEqual(['k2']);
  });
});
