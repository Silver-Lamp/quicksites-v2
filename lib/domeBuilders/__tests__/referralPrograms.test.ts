/**
 * @jest-environment node
 */
// Referral links on the directory: disclosed, never reordering, only when a program is active.
import {
  REFERRAL_PROGRAMS,
  activeReferralFor,
  applyReferrals,
  normalizeOrgName,
} from '@/lib/domeBuilders/referralPrograms';
import { readFileSync } from 'node:fs';

describe('the registry', () => {
  it('every program has a real https program URL and a status', () => {
    for (const p of REFERRAL_PROGRAMS) {
      expect(p.programUrl).toMatch(/^https:\/\//);
      expect(['found', 'applied', 'active', 'declined']).toContain(p.status);
      if (p.status === 'active') expect(p.affiliateUrl).toMatch(/^https:\/\//);
    }
  });
  it('matches entry names loosely (Inc/LLC/parentheses ignored)', () => {
    expect(normalizeOrgName('Growing Spaces (Growing Dome)')).toBe(
      normalizeOrgName('Growing Spaces Growing Dome')
    );
    expect(normalizeOrgName('Domespaces ®')).toBe('domespaces');
  });
});

describe('applyReferrals', () => {
  const entries: Array<{ name: string; affiliate_url?: string }> = [
    { name: 'Florida Domes' },
    { name: 'Glamping Dome Store' },
    { name: 'Ekodome' },
  ];
  it('is a no-op while nothing is active — no link, no reorder', () => {
    const out = applyReferrals(entries);
    expect(out.map((e) => e.name)).toEqual(entries.map((e) => e.name));
    expect(out).toEqual(entries);
    expect(out.every((e, i) => e === entries[i])).toBe(true);
  });
  it('never returns null for an org with no program', () => {
    expect(activeReferralFor('Florida Domes')).toBeNull();
  });
});

describe('the renderer', () => {
  const src = readFileSync(
    'components/admin/templates/render-blocks/builders-directory.tsx',
    'utf8'
  );
  it('marks affiliate links as sponsored and labels them, and renders the disclosure when any exist', () => {
    expect(src).toContain('rel="noopener noreferrer sponsored"');
    expect(src).toContain('(affiliate)');
    expect(src).toContain('d.hasAffiliate && d.affiliateDisclosure');
  });
});
