// lib/serp/packStrength.ts
//
// HOW WEAK IS THE LOCAL PACK — the signal we already owned and never read.
//
// ⚠️ WHY THIS EXISTS. `classify.ts` treats every full pack as `skip`: three businesses is the answer
// to the query, so organic loses. That rule is right about the towing control and it threw away
// information, because a pack of three businesses with four reviews each is not the same
// proposition as three with five hundred. We were already storing the answer — DataForSEO returns
// `rating.votes_count` on every `local_pack` item — and nothing looked at it.
//
// ⚠️ IT SEPARATES OUR TWO CONTROLS ON THE FIRST TRY, WHICH IS WHY IT IS HERE AND NOT A GUESS.
// Computed over 373 stored readings (2026-09-24), no new spend:
//
//     towing service near me  (known LOSS: position 10.9, 69 impressions, ZERO clicks)
//         3 listings, 0 under 20 reviews, mean 323 votes
//     treehouse builder …     (known WIN: cohort bought, a builder ranks #1 for its own query)
//         48 listings, 33 under 20 reviews, 8 with no rating at all, mean 9 votes
//
// A 36× separation, and the ordering across the other niches matched the verdicts our own sweep
// reached independently (natural pools 116 · domes 68 · sport courts 31 · bunkers 1).
//
// ⚠️ ADAPTED FROM A RANK-AND-RENT PRACTITIONER'S CRITERIA, NOT INVENTED HERE. The threshold — "at
// least 2 competitors in the target city with fewer than 20 reviews" — is theirs. What is ours is
// checking it against a known loss and a known win before believing it.
//
// ⚠️ DELIBERATELY NOT WIRED INTO `verdictFor`. The classifier was calibrated against a person's
// hand-scored run and agrees with them on four rows; changing the rule would discard that
// calibration to chase a signal validated on two controls. This reports ALONGSIDE the verdict, so a
// full pack can be marked "full, but weak — worth a hand check" rather than silently becoming green.

/** One business in the pack. `votes: null` means Google showed no rating at all. */
export type PackListing = { votes: number | null };

/** Their rule, stated as a constant so it is arguable rather than buried in a comparison. */
export const WEAK_REVIEW_COUNT = 20;
/** How many weak listings make the pack itself weak. */
export const WEAK_LISTINGS_NEEDED = 2;

export type PackStrength = {
  listings: number;
  /** Shown with no rating — almost always a business with no reviews, so it counts as weak. */
  unrated: number;
  /** Listings under WEAK_REVIEW_COUNT, counting unrated ones. */
  weak: number;
  /** Median votes across RATED listings; null when none are rated. */
  medianVotes: number | null;
  /** True when at least WEAK_LISTINGS_NEEDED listings are weak. */
  isWeak: boolean;
};

export function readPackStrength(listings: readonly PackListing[]): PackStrength {
  const n = listings.length;
  const rated = listings
    .map((l) => l.votes)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
    .sort((a, b) => a - b);
  const unrated = n - rated.length;
  // ⚠️ An unrated listing counts as WEAK, not as unknown. Google omits the rating block when a
  // business has no reviews to show; treating it as missing data would systematically read the
  // weakest possible competitor as the most uncertain one — backwards, and biased toward "skip".
  const weak = unrated + rated.filter((v) => v < WEAK_REVIEW_COUNT).length;
  const medianVotes = rated.length
    ? rated.length % 2
      ? rated[(rated.length - 1) / 2]
      : Math.round((rated[rated.length / 2 - 1] + rated[rated.length / 2]) / 2)
    : null;
  return { listings: n, unrated, weak, medianVotes, isWeak: weak >= WEAK_LISTINGS_NEEDED };
}

/**
 * Pull the pack listings out of a stored DataForSEO payload.
 *
 * ⚠️ Reads the RAW we already store, so every reading ever taken can be scored retroactively for
 * nothing. That is the whole reason this shipped the same day it was proposed.
 */
export function packListingsFromRaw(raw: unknown): PackListing[] {
  const items = (raw as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];
  return items
    .filter((i: any) => i?.type === 'local_pack')
    .map((i: any) => {
      const votes = i?.rating?.votes_count;
      return { votes: typeof votes === 'number' && Number.isFinite(votes) ? votes : null };
    });
}

/**
 * One line a person can act on, or null when there is no pack to describe.
 *
 * The phrasing matters: a weak full pack is a REASON TO LOOK, never a verdict. The sweep's own
 * standing rule is that a high score earns a hand check, not a domain purchase.
 */
export function describePackStrength(s: PackStrength): string | null {
  if (!s.listings) return null;
  const median = s.medianVotes === null ? 'none rated' : `median ${s.medianVotes} reviews`;
  return s.isWeak
    ? `pack of ${s.listings} but ${s.weak} under ${WEAK_REVIEW_COUNT} reviews (${median}) — weak, worth a hand check`
    : `pack of ${s.listings}, ${median} — established`;
}
