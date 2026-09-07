// lib/outreach/postcardProof.ts
//
// May this campaign's postcard claim a ranking, and in exactly which words?
//
// ⚠️ A postcard is the most conservative surface we own. A rep can walk a sentence back mid-call;
// a printed card that reached someone's mailbox cannot be caveated, corrected or recalled. So the
// proof line is never typed, never remembered and never inherited from a spreadsheet — it is read
// from the same live Search Console data the rate card reads, at send time, or it is omitted.
//
// This is deliberately the SAME qualification rule as /for-sales/rate-card (lib/sales/rateCard.ts),
// imported rather than restated: a domain the rep may not call "page one" on the phone must not be
// called "page one" in the post.

import { loadRateCard } from '@/lib/sales/rateCardData';
import { bareHost } from '@/lib/sales/rateCardData';

export type PostcardProof = { query: string; position: number; measuredAt: string };

export type ProofLookup =
  | { proven: true; proof: PostcardProof }
  | { proven: false; reason: 'no-gsc-data' | 'not-page-one' | 'blocked'; detail: string };

/**
 * Look up present-tense proof for a campaign domain. Returns `proven: false` with a reason a human
 * can act on — never a bare null, because "we did not print a ranking claim" and "we could not tell
 * whether one was true" are different situations and the operator needs to know which.
 */
export async function proofForDomain(domain: string | null | undefined): Promise<ProofLookup> {
  const host = bareHost(String(domain ?? ''));
  if (!host) return { proven: false, reason: 'no-gsc-data', detail: 'The campaign has no domain.' };

  const { rows, measuredAt } = await loadRateCard();
  const row = rows.find((r) => r.host === host);

  if (!row) {
    return {
      proven: false,
      reason: 'no-gsc-data',
      detail:
        `${host} has no Search Console data cached. Connect the property and refresh the rate ` +
        `card, or send founder-tier copy that makes no ranking claim.`,
    };
  }
  if (!row.qualifies || !row.proofQuery || row.proofPosition == null) {
    return {
      proven: false,
      reason: 'not-page-one',
      detail:
        `${host} does not hold page one for its own city+trade phrase` +
        (row.siteAveragePosition ? ` (site average position ${row.siteAveragePosition})` : '') +
        `. Founder-tier copy only.`,
    };
  }
  // A domain can rank and still be unfit to put in front of a stranger — no phone on the site,
  // no service area. Ranking is not the only thing a postcard implies is real.
  if (!row.pitchable) {
    return {
      proven: false,
      reason: 'blocked',
      detail: `${host} ranks but is blocked: ${row.blockers.filter((b) => b.severity === 'stop').map((b) => b.label).join('; ')}`,
    };
  }

  return {
    proven: true,
    proof: {
      query: row.proofQuery,
      position: row.proofPosition,
      measuredAt: (measuredAt ?? '').slice(0, 10),
    },
  };
}
