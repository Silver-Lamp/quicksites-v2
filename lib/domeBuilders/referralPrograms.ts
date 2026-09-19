// lib/domeBuilders/referralPrograms.ts
//
// Referral / affiliate programs offered by orgs in the dome-builders directory, found by probing
// each org's site on 2026-09-19 (five of seventeen kit makers / suppliers run one). This file is
// the ONE place a program's status and our link live; scripts/dome-builders-apply-referrals.mts
// pushes `affiliateUrl` onto every directory entry whose name matches and republishes.
//
// Rules (rendered, not hidden — components/…/builders-directory.tsx):
//   - an affiliate link replaces the plain website link and is labelled "(affiliate)" with
//     rel="sponsored"; a disclosure sentence renders whenever any entry carries one;
//   - a program never changes WHO is listed or in what order — the directory is sourced first,
//     monetised second, and a test pins that entries are not reordered by affiliate presence;
//   - signing up is an owner action (accounts, agreements, payout details); a session records
//     the link here when Sandon supplies it. `status` is 'found' until then.

export type ReferralStatus = 'found' | 'applied' | 'active' | 'declined';

export type ReferralProgram = {
  /** Must match the directory entry `name` (case-insensitive; "Inc"/"LLC" ignored). */
  org: string;
  programUrl: string;
  /** What the program page says. Quoted or paraphrased; blank when the terms are gated. */
  terms: string;
  status: ReferralStatus;
  /** Our tracked link, once the account exists. */
  affiliateUrl?: string;
  notes?: string;
};

export const REFERRAL_PROGRAMS: ReferralProgram[] = [
  {
    org: 'Glamping Dome Store',
    programUrl: 'https://www.glampingdomestore.com/pages/new-affiliate-marketing-program',
    terms:
      '5% commission on the sale total; paid manually per order (they send the invoice copy and ask for banking details).',
    status: 'found',
  },
  {
    org: 'Ekodome',
    programUrl: 'https://ekodome.com/affiliates/',
    terms:
      'Marketing affiliate program with a dashboard (referral ID, custom links, click/purchase tracking). Rate is in the agreement, which is login-gated.',
    status: 'found',
  },
  {
    org: 'Growing Spaces (Growing Dome)',
    programUrl: 'https://growingspaces.com/ambassadors',
    terms:
      'Ambassador program: a cash reward per closed referral, scaled by dome size; personal page, link, code and QR. Open to organizations (creators need 1,000+ followers).',
    status: 'found',
    notes: 'Apply as an organization (Point Seven Studio / the directory), not as a creator.',
  },
  {
    org: 'Domespaces',
    programUrl: 'https://domespaces.com/affiliate-area/?affiliates-dashboard-section=registration',
    terms:
      'Self-serve affiliate registration (WordPress Affiliates); terms shown after registering.',
    status: 'found',
  },
  {
    org: 'Pacific Domes',
    programUrl: 'https://store.pacificdomes.com/affiliate-home/',
    terms:
      'An "Affiliates Area" on the store; the store subdomain did not resolve from our side on 2026-09-19 — confirm in a browser.',
    status: 'found',
  },
];

export function normalizeOrgName(n: string): string {
  return n
    .toLowerCase()
    .replace(/\((.*?)\)/g, ' $1 ')
    .replace(/\b(inc|llc|corp|corporation|co|company|®)\b\.?/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** The active program (with a link) for a directory entry name, or null. */
export function activeReferralFor(entryName: string): ReferralProgram | null {
  const key = normalizeOrgName(entryName);
  return (
    REFERRAL_PROGRAMS.find(
      (p) =>
        p.status === 'active' &&
        !!p.affiliateUrl &&
        (normalizeOrgName(p.org) === key || key.includes(normalizeOrgName(p.org).slice(0, 8)))
    ) ?? null
  );
}

/**
 * Pure: return the entries with `affiliate_url` set from the active programs. Order and
 * membership are unchanged by construction — the map is index-preserving.
 */
export function applyReferrals<T extends { name: string; affiliate_url?: string }>(
  entries: T[]
): T[] {
  return entries.map((e) => {
    const p = activeReferralFor(e.name);
    if (p) return { ...e, affiliate_url: p.affiliateUrl! };
    // No active program: return the SAME object, so a dry run reports no change.
    return e;
  });
}
