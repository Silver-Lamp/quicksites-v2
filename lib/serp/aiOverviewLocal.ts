// lib/serp/aiOverviewLocal.ts
//
// READ THE LOCAL BUSINESS BLOCK INSIDE A FETCHED AI OVERVIEW.
//
// ⚠️ THIS IS THE SECOND ATTEMPT. The first (`aiOverviewCitesLocalBusinesses`) guessed from
// `google.com` references and a "local" in the title, fired on 86% of pages, and failed its control
// backwards — treehouses, a cohort with four live sites, scored 100% while horse barns, where a
// hand check had photographed an actual block, scored 22%. It is kept, unwired, as a warning.
//
// What changed is that we looked at the payload instead of reasoning about it. With
// `load_async_ai_overview` the elements carry MARKDOWN, and the block renders as a table row:
//
//   | ![img] | Texas Pole Barns 4.6 (18) | Construction company | Open 11519 Pecan Creek Pkwy #23
//   | Call Directions Website |
//   - **Address:** 11519 Pecan Creek Pkwy #23, Austin, TX 78750
//
// So the signal is the thing that makes it a business listing rather than prose: **the action
// buttons**. "Call", "Directions" and "Website" are rendered because Google attached a Business
// Profile, and no amount of editorial text about local regulations produces them.
//
// ⚠️ VALIDATED AGAINST ONE CONTROL — AND THE OTHER "CONTROL" DOES NOT EXIST. This correction is
// the most important line in the file, because the first attempt died of exactly this:
//
//   horse barns   86% of fetched overviews carry a block   — screenshots show it on every check ✓
//   treehouses    46%                                      — ⚠️ NOT A CONTROL. SEE BELOW.
//   domes         11%  ·  grain bins 13%  ·  bunkers 21%
//
// The horse-barn leg is real: 86% against a cohort where a person photographed the block on every
// hand check. That is agreement with direct observation, and it is what this detector rests on.
//
// ⛔ **TREEHOUSES IS NOT A CONTROL AND NEVER WAS.** `gsc_queries` holds **0 rows** for every
// treehouse domain — the sites exist, nothing has ever been measured on them. The phrase that made
// it feel like one ("a builder ranks first for its own query") is World Treehouses ranking for its
// own BRAND NAME, which is the self-referential pattern `isSelfReferential` exists to exclude. So
// "treehouses scored lower ✓" is not a passing grade; it is a number next to a number. An earlier
// draft of this header claimed validation against "both controls", and three separate signals were
// rejected in one day on the strength of that phantom.
//
// ⚠️ **THE ONLY VALIDATED CONTROL IN THIS REPO IS TOWING, AND IT IS A LOSS** (position 10.9, 69
// impressions, 0 clicks). There is **no positive control** — nothing we can point to that we know
// wins — which means a calibration argument here cannot be falsified in the direction that spends
// money. Read every percentage below with that missing.
//
// ⚠️ IT ALSO YIELDS REVIEW COUNTS, so the pack-strength test (`packStrength.ts`) applies to a block
// our `local_pack` reader cannot see at all — the businesses in the overview are frequently the
// same small operators, and `4.6 (18)` is right there in the markdown.
//
// ⛔ **NOT WIRED INTO SCORING, DELIBERATELY.** One cohort agreeing with photographs is a good sign
// and it is not two. `hasLocalCompetitionAbove` in `aiOverview.ts` still returns its narrow "no
// pack we can see", and nothing calls this yet.
//
// ⚠️ Note which way the bias runs before arguing to wire it: this detector only ever turns a
// verdict from "open ground" toward "occupied", so switching it on spends LESS, not more. That is
// the safe direction — which is exactly why it is tempting to skip the second control, and exactly
// the reasoning that shipped an 86%-firing detector last time. **The condition for wiring it: one
// more cohort hand-checked against screenshots, where the detector's answer is written down before
// the screenshots are looked at.** Not a rerun over stored rows — those produced the phantom.

export type OverviewBusiness = { name: string; rating: number | null; reviews: number | null };

export type OverviewLocalBlock = {
  /** True when the overview renders at least one business with action buttons. */
  present: boolean;
  businesses: OverviewBusiness[];
};

/** Every element's markdown, joined. Null when the overview was never fetched. */
function overviewMarkdown(raw: unknown): string | null {
  const items = (raw as any)?.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return null;
  const aio = items.find((i: any) => i?.type === 'ai_overview');
  if (!Array.isArray(aio?.items)) return null;
  return aio.items.map((e: any) => String(e?.markdown ?? e?.text ?? '')).join('\n');
}

/**
 * ⚠️ The button labels are the signal, and they must appear TOGETHER on a line with a business.
 * Matching a bare "Call" anywhere would fire on "Call for a quote" in ordinary prose — the same
 * over-firing that sank the first attempt, in a new costume.
 */
const BUTTON_RUN = /\bCall\b[^|\n]{0,20}\b(?:Directions|Website)\b/;
/** `4.6 (18)` — a rating immediately followed by its review count. */
const RATING = /([A-Za-z][A-Za-z0-9&'.,\- ]{2,60}?)\s+(\d\.\d)\s*\((\d[\d,]*)\)/g;

export function readOverviewLocalBlock(raw: unknown): OverviewLocalBlock {
  const md = overviewMarkdown(raw);
  if (md === null) return { present: false, businesses: [] };

  const present = md.split('\n').some((line) => BUTTON_RUN.test(line));
  if (!present) return { present: false, businesses: [] };

  const businesses: OverviewBusiness[] = [];
  const seen = new Set<string>();
  for (const m of md.matchAll(RATING)) {
    // The captured name runs backwards from the rating, so trim table pipes and image junk off it.
    const name = m[1].replace(/^[\s|>*_-]+/, '').replace(/!\[.*$/, '').trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    businesses.push({
      name,
      rating: Number(m[2]) || null,
      reviews: Number(String(m[3]).replace(/,/g, '')) || null,
    });
  }
  return { present, businesses };
}

/**
 * Is there local competition above the organic results, counting the AI Overview?
 *
 * `null` means we could not tell — the overview was never fetched — and the caller must not read
 * that as either answer. A `local_pack` that WAS found always wins: an overview cannot un-see it.
 */
export function localCompetitionAbove(input: { packSize: number; raw: unknown }): boolean | null {
  if (input.packSize > 0) return true;
  const md = overviewMarkdown(input.raw);
  if (md === null) return null;
  return readOverviewLocalBlock(input.raw).present;
}
