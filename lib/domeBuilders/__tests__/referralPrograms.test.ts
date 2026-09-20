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
  const noProgram: Array<{ name: string; affiliate_url?: string }> = [
    { name: 'Florida Domes' },
    { name: 'Carolina Domes' },
  ];
  it('is the identity for entries with no active program — same objects, same order', () => {
    const out = applyReferrals(noProgram);
    expect(out).toEqual(noProgram);
    expect(out.every((e, i) => e === noProgram[i])).toBe(true);
  });
  it('sets affiliate_url from an ACTIVE program and touches nothing else', () => {
    const active = REFERRAL_PROGRAMS.filter((p) => p.status === 'active' && p.affiliateUrl);
    for (const p of active) {
      const out = applyReferrals<{ name: string; affiliate_url?: string }>([
        { name: 'Florida Domes' },
        { name: p.org },
      ]);
      expect(out[0]).toEqual({ name: 'Florida Domes' });
      expect(out[1].affiliate_url).toBe(p.affiliateUrl);
      expect(out.map((e) => e.name)).toEqual(['Florida Domes', p.org]);
    }
  });
  it('never returns a program for an org with none', () => {
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
