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
