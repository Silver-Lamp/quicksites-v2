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
  return items.some((i: any) => {
    if (i?.type !== 'ai_overview') return false;
    // ⚠️ THE ABSENT CONTENTS ARE THE EVIDENCE — NOT THE FLAG.
    //
    // `asynchronous_ai_overview` stays TRUE even when the contents were fetched: it records that
    // Google loaded the overview asynchronously, not that we failed to get it. The first version of
    // this function treated the flag alone as proof of blindness, and the first sweep run with
    // `load_async_ai_overview` enabled came back with four populated elements and the flag still
    // true — so every good reading we collected from then on would have been silently discarded as
    // unverifiable. Caught by checking the data after the change rather than trusting the change.
    const hasItems = Array.isArray(i.items) && i.items.length > 0;
    const hasMarkdown = typeof i.markdown === 'string' && i.markdown.length > 0;
    return !hasItems && !hasMarkdown;
  });
}

/**
 * Does a FETCHED AI Overview cite local business listings?
 *
 * ⛔ **NOT VALIDATED — DO NOT SCORE ON THIS.** It is exported for investigation only, and
 * `hasLocalCompetitionAbove` deliberately does not call it. Measured against the controls on
 * 2026-09-24, four candidate rules and not one of them separated the two cases that matter:
 *
 *   rule                              overall   treehouse (known WIN)   horse barns (known local)
 *   any google ref or title             86%          100%  ✗                  100%  ✓
 *   >= 2 google refs on one element     29%           31%                      22%  ✗
 *   provider-ish title + a ref          49%           85%  ✗                   33%  ✗
 *   both, strict                        20%           23%                      11%  ✗
 *
 * The loose rule fires on everything; the tight ones fire MORE on treehouses — a cohort with four
 * live sites and a builder ranking first — than on horse barns, where a hand check photographed an
 * actual local block. That is backwards, so the signal does not discriminate.
 *
 * ⚠️ Why the obvious signals fail: `google.com` appears in 72% of overviews (Maps, support pages,
 * anything), and the title regex matches section headings like "Local Context & Regulations", which
 * is about zoning rules, not businesses.
 *
 * ⚠️ WHAT IS STILL TRUE: a local pack CAN hide inside an AI Overview — that is photographed, not
 * theorised. We simply cannot yet tell from the API which overviews contain one. A known,
 * stated blind spot beats a detector that fails its control.
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
  // ⛔ Deliberately NOT `aiOverviewCitesLocalBusinesses(...)` — see the note on that function. It
  // flagged 86% of pages and failed the treehouse control, so scoring on it would have replaced a
  // measurable optimism with an unmeasurable pessimism. Returning false here means "no pack we can
  // see", which is exactly as much as we can honestly claim today.
  return false;
}
