// lib/outreach/attachProspects.ts
//
// Attach swept prospects to a geo campaign — the missing link between "I swept a city" and
// "I can mail someone".
//
// ⚠️ Building a site for a prospect does NOT attach it to a domain's campaign. Only the launch
// flow did that, and a domain adopted through "make rentable" has no cohort at all — so
// mail-postcards found zero recipients while the workspace showed a screen full of businesses.
//
// ⚠️ linkProspectsToCampaign OVERWRITES geo_campaign_id unconditionally. Attaching a prospect that
// already belongs to another city's campaign silently moves it, and the campaign it left loses a
// recipient with nothing on screen saying so. That is why this plans before it writes.

export type AttachProspect = {
  id: string;
  business_name?: string | null;
  address?: string | null;
  city?: string | null;
  geo_campaign_id?: string | null;
};

export type AttachPlan = {
  /** Not attached to anything yet — the ordinary case. */
  free: AttachProspect[];
  /** Already on THIS campaign; attaching again is a no-op worth reporting rather than counting. */
  alreadyHere: AttachProspect[];
  /** On a DIFFERENT campaign. Never moved without an explicit reassign. */
  elsewhere: AttachProspect[];
  /**
   * Attached, but their address is not in the campaign's town.
   *
   * ⚠️ Advisory, never a block — but it is the mistake this workflow makes by default. A sweep for
   * "towing service" near Arab returns businesses up to forty miles out, and an exact-match pitch
   * for arab-towing.com is worth nothing to a shop in Scottsboro. Of 27 prospects a real sweep
   * returned, 4 rows were actually in Arab.
   */
  offCity: AttachProspect[];
};

/** Loose containment: "651 Sundown Dr NW, Arab, AL 35016, USA" contains "Arab". */
export function addressLooksLike(address: string | null | undefined, city: string | null | undefined): boolean {
  const a = String(address ?? '').toLowerCase();
  const c = String(city ?? '').trim().toLowerCase();
  if (!c) return true; // no campaign city to compare against — do not invent a warning
  if (!a) return false; // an address we cannot read is not evidence that it matches
  return a.includes(c);
}

export function planAttachment(
  prospects: AttachProspect[],
  campaign: { id: string; city?: string | null },
): AttachPlan {
  const free: AttachProspect[] = [];
  const alreadyHere: AttachProspect[] = [];
  const elsewhere: AttachProspect[] = [];

  for (const p of prospects) {
    const current = p.geo_campaign_id ?? null;
    if (!current) free.push(p);
    else if (current === campaign.id) alreadyHere.push(p);
    else elsewhere.push(p);
  }

  // Only warn about the ones we would actually attach.
  const offCity = [...free, ...elsewhere].filter((p) => !addressLooksLike(p.address, campaign.city));

  return { free, alreadyHere, elsewhere, offCity };
}


export type CampaignMatch = { industry_key?: string | null; city?: string | null };

/** How we came to believe this business does the campaign's trade. Never inferred silently. */
export type TradeEvidence = 'industry' | 'category' | 'name' | null;

/**
 * Words that mean "this business does this trade", found in its NAME.
 *
 * ⚠️ The name is the only usable signal for the case this exists for, and that is a finding rather
 * than a guess: every one of Arab Towing / Lake City Auto Repair & Towing / Perfect Choice Towing &
 * Recovery / Uni Towing carries `industry_key='auto_repair'` AND Google categories of exactly
 * `car_repair, store, point_of_interest, service, establishment`. There is nothing to match on but
 * what the owner called their company — which is, reasonably, the thing they most want to be found
 * for.
 *
 * Kept deliberately short and strong. 'recovery' and 'auto' are NOT here: "Recovery" appears in
 * rehab clinics and "auto" in every car business alive, and a keyword that pulls in the wrong trade
 * costs more than one that misses a right one — a missed prospect is ticked by hand, a wrong one is
 * mailed a pitch that makes no sense.
 */
const TRADE_NAME_WORDS: Record<string, readonly string[]> = {
  towing: ['towing', 'tow', 'wrecker', 'roadside'],
  plumbing: ['plumbing', 'plumber', 'rooter', 'drain'],
  hvac: ['hvac', 'heating', 'cooling', 'air conditioning', 'furnace'],
  electrical: ['electric', 'electrical', 'electrician'],
  roof_cleaning: ['roof cleaning', 'roof wash', 'soft wash'],
  roofing: ['roofing', 'roofer'],
  pressure_washing: ['pressure washing', 'power washing', 'soft wash'],
  window_washing: ['window cleaning', 'window washing'],
  windshield_repair: ['windshield', 'auto glass'],
  junk_removal: ['junk removal', 'hauling'],
  landscaping: ['landscaping', 'lawn care'],
  pest_control: ['pest control', 'exterminator'],
};

/** Whole-word match, so "Tow" hits and "Towne" does not. */
function nameMentions(name: string | null | undefined, words: readonly string[]): boolean {
  const n = String(name ?? '').toLowerCase();
  if (!n) return false;
  return words.some((w) => new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`, 'i').test(n));
}

/**
 * Why we think this business does the campaign's trade — or null, meaning we do not.
 *
 * Returned rather than a boolean so the operator can see WHICH prospects are inferred from a name
 * instead of stated by their industry key. An inference presented identically to a fact is how a
 * cohort quietly fills up with businesses nobody checked.
 */
export function tradeEvidence(
  p: { business_name?: string | null; industry_key?: string | null; categories?: readonly string[] | null },
  industryKey: string | null | undefined,
): TradeEvidence {
  const want = String(industryKey ?? '').trim();
  if (!want) return 'industry'; // nothing to prove against
  if (String(p.industry_key ?? '').trim() === want) return 'industry';

  const words = TRADE_NAME_WORDS[want];
  if (words && Array.isArray(p.categories) && p.categories.some((c) => nameMentions(String(c).replace(/_/g, ' '), words))) {
    return 'category';
  }
  if (words && nameMentions(p.business_name, words)) return 'name';
  return null;
}

/**
 * Is this prospect actually a candidate for THIS campaign — same trade, same town?
 *
 * ⚠️ The bulk "attach everything with no website" default was wrong in a way that only shows up
 * when you read the list: a sweep for towing near Arab returned auto-repair shops, a moving
 * company, and a vegan kitchen in Washington. Attaching those to arab-towing.com produces a cohort
 * that looks mailable and is mostly a wrong pitch — an exact-match domain means nothing to a
 * business in another trade, and less than nothing to one in another state.
 *
 * The trade comparison is exact because industry_key is a controlled value on both sides. The town
 * comparison is loose, because an address is free text.
 */
export function matchesCampaign(
  p: Pick<AttachProspect, 'address'> & {
    industry_key?: string | null;
    business_name?: string | null;
    categories?: readonly string[] | null;
  },
  campaign: CampaignMatch,
): boolean {
  // A business whose NAME says it tows counts, even when its industry key says auto repair — that
  // is most of the towing trade in a small town, and excluding it was excluding the best prospects.
  if (tradeEvidence(p, campaign.industry_key) === null) return false;
  return addressLooksLike(p.address, campaign.city);
}
