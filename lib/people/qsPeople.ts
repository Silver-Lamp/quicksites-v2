// lib/people/qsPeople.ts — the people a QuickSites /for-<name> page was written for.
//
// The mesh's people dashboard lives on HiveJournal (/dashboard/admin/people, PEOPLE in their
// services/people-core.ts). Owner, 2026-10-17: "include Craig and anyone else we missed on the
// QS side." HJ's list is code-owned there and we never edit sibling repos, so this is OUR
// code-owned list, served to HJ by GET /api/partner/hj/people (contract:
// crosstalk/contracts/people-registry.md) with 60 days of visits to each page.
//
// Names and relationships only — never contact details (same rule as HJ's list). A person is on
// this list because a page was written for them, not because they have an account.
export type QsPersonGroup = 'team' | 'partner' | 'client' | 'pitch';

export type QsPerson = {
  /** Stable key, shared with HJ's registry where the same person appears there. */
  key: string;
  name: string;
  /** One line: who they are to us. */
  relation: string;
  /** The page on www.quicksites.ai. */
  pitchPath: string;
  group: QsPersonGroup;
  /** Their referral code, when they have one (reps and partners). Never a payout figure. */
  code?: string;
};

export const QS_PEOPLE: QsPerson[] = [
  { key: 'craig', name: 'Craig', relation: 'Vashon Island flyer rep: hourly + lifetime share, hours logged on /admin/rep-hours', pitchPath: '/for-craig', group: 'team', code: 'craig' },
  { key: 'abdou', name: 'Abdou', relation: 'Vashon Island rep: builds no-website businesses their site from /for-abdou; starter kit at /starter-kit/abdou', pitchPath: '/for-abdou', group: 'partner', code: 'abdou' },
  { key: 'amber', name: 'Amber', relation: 'Vashon: a permitted commissary kitchen (the Eagles) for PorchHearth cooks', pitchPath: '/for-amber', group: 'partner', code: 'amber' },
  { key: 'amy', name: 'Amy', relation: 'Team: the QuickSites brief beside the Cornerstone Display rollout', pitchPath: '/for-amy', group: 'team' },
  { key: 'angela', name: 'Angela', relation: 'Laguna Beach live-music work: QuickSites side of the pitch', pitchPath: '/for-angela', group: 'partner', code: 'angela' },
  { key: 'daniel', name: 'Daniel Russo', relation: 'ScaleUp Software: first white-label reseller org, mints his own reps at /for/<code>', pitchPath: '/for-daniel', group: 'partner', code: 'daniel' },
  { key: 'ryan', name: 'Ryan', relation: 'Design partner: realtor agency template, About That / IDX pilot', pitchPath: '/for-ryan', group: 'partner', code: 'ryan' },
  { key: 'daryle', name: 'Daryle', relation: 'B Your Best: B Hard merchant (bhard.store), payments/ISO partner', pitchPath: '/for-daryle', group: 'client' },
];

/** The registry key a visited QuickSites path counts toward, or null. */
export function qsPersonKeyFromPath(path: unknown): string | null {
  if (typeof path !== 'string') return null;
  const m = path.match(/^\/(for-[a-z0-9-]{1,50})\/?(?:[?#].*)?$/);
  if (!m) return null;
  return QS_PEOPLE.find((p) => p.pitchPath === `/${m[1]}`)?.key ?? null;
}
