// lib/serp/aiOverview.ts
//
// ⚠️ THE BOX WE NEVER OPENED.
//
// Google loads the AI Overview asynchronously, so DataForSEO's organic endpoint returns a
// PLACEHOLDER for it — `asynchronous_ai_overview: true` with `items`, `references` and `markdown`
// all null. Fetching the contents needs a separate paid call we do not make. So for those readings
// we know an overview exists and know NOTHING about what is inside it, while `blocksAbove` counts it
// as one block whether it holds a single sentence or a full local pack with phone numbers.
//
// ⚠️ IT IS NOT A LOCAL PACK, EXCEPT WHEN IT IS. A hand check on 2026-09-24 (`horse barn builder
// austin`) found this inside the overview, above every organic result:
//
//     Local Horse Barn Builders & Designers
//       Texas Pole Barns · 4.6 ★ (18) · Construction company · Open · 11519 Pecan Creek Pkwy
//       [ Call ] [ Directions ] [ Website ]   … Show more
//
// The API reported `item_types: [ai_overview, organic, people_also_ask, related_searches]` — no
// `local_pack` — so the classifier scored the page pack-free, i.e. wide open.
//
// ⚠️ SCOPE AND DIRECTION, MEASURED: 334 of 564 readings (59%) carry an unfetched overview, and 184
// of those we scored pack-free. **The bias runs toward spending money** — an overview we failed to
// open reads exactly like an overview that contains nothing, and "nothing above the organic results"
// is the most favourable verdict the tool can return.
//
// ⚠️ WHY A RE-READ DOES NOT FIX THIS, unlike the truncation guard next door. A short response is
// transient and a second call usually gets a whole one. This is not transient: the organic endpoint
// never returns the contents, so reading again returns the same placeholder forever. The remedy is
// to stop counting these as evidence, not to sample harder.

/** True when the payload says an AI Overview exists AND its contents were not returned. */
export function hasUnfetchedAiOverview(raw: unknown): boolean {
  const items = (raw as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return false;
  return items.some(
    (i: any) =>
      i?.type === 'ai_overview' &&
      // The flag is what DataForSEO sets; the null contents are the corroboration. Either alone is
      // enough to distrust the reading, and requiring both would let a shape change slip past.
      (i.asynchronous_ai_overview === true || (i.items == null && i.markdown == null))
  );
}

/**
 * Does a FETCHED AI Overview cite local business listings?
 *
 * ⚠️ THE PAYOFF OF FETCHING: this turns an absence we could not interpret into evidence we can.
 * Before `load_async_ai_overview`, a hidden local pack was indistinguishable from an empty overview
 * and we could only distrust the reading. Now we can say the pack is there.
 *
 * The signal is STRUCTURAL rather than a title match: Google Business Profile citations appear as
 * `google.com` references on the overview's elements. On `horse barn builder austin` the element
 * titled "Local Horse Barn Builders" carries exactly those, alongside the builders' own domains —
 * which is the same block the hand check photographed with Call / Directions / Website buttons.
 *
 * ⚠️ A title match is kept as a SECONDARY signal only. "Local …" is how Google labels it today and
 * is one wording change from silently returning false; the references are the part that has to
 * exist for the citation to work at all.
 */
export function aiOverviewCitesLocalBusinesses(raw: unknown): boolean {
  const items = (raw as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return false;
  const aio = items.find((i: any) => i?.type === 'ai_overview');
  const elements = aio?.items;
  if (!Array.isArray(elements)) return false;
  return elements.some((el: any) => {
    const refs = Array.isArray(el?.references) ? el.references : [];
    const citesProfiles = refs.some((r: any) =>
      String(r?.domain ?? r?.url ?? '').toLowerCase().includes('google.com')
    );
    const titledLocal = /\blocal\b|\bnear (you|me)\b/i.test(String(el?.title ?? ''));
    return citesProfiles || titledLocal;
  });
}

/**
 * Can this reading support a claim that nothing local sits above the organic results?
 *
 * ⚠️ ONLY THE "NO PACK" CASE IS POISONED. A reading that FOUND a full pack is still trustworthy —
 * an unopened overview cannot un-see three map pins. So this narrows to exactly the claim the
 * missing data could falsify, rather than discarding good readings along with bad.
 */
export function packFreeClaimIsVerifiable(input: {
  packSize: number;
  raw: unknown;
}): boolean {
  if (input.packSize > 0) return true;
  return !hasUnfetchedAiOverview(input.raw);
}

/**
 * Is there local competition above the organic results, counting the AI Overview?
 *
 * ⚠️ This is the question `packSize` was standing in for, and getting wrong. A page with no
 * `local_pack` item but an AI Overview citing Google Business Profiles is not open ground — it is
 * the same competition rendered somewhere our item taxonomy does not look.
 *
 * Returns `null` when the overview was never fetched: that is "unknown", and the caller must not
 * read it as either answer. Nothing here overrides a `local_pack` that was actually found.
 */
export function hasLocalCompetitionAbove(input: {
  packSize: number;
  raw: unknown;
}): boolean | null {
  if (input.packSize > 0) return true;
  if (hasUnfetchedAiOverview(input.raw)) return null;
  return aiOverviewCitesLocalBusinesses(input.raw);
}
