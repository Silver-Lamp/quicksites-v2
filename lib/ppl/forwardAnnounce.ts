// lib/ppl/forwardAnnounce.ts
//
// What the CALLER hears on a geo tracking number before we bridge them to a business.
//
// ⚠️ THIS FILE EXISTS BECAUSE OF ONE REAL CALL, AND THE OLD COPY WAS THE BUG.
// On 2026-10-01 a member of the public dialled the number printed on `southhilltowing.com`
// (a page that says "South Hill Towing" 42 times; no such business exists — the name is
// generated from city + trade in `buildGeoPitchSite`). She heard:
//
//     "Thanks for calling. Please hold while I connect you."
//
// …and was bridged to Too Cool Towing, who honestly told her she had not reached South Hill
// Towing. She hung up. 15 seconds, logged as `connected`, and NOT a delivered lead.
//
// Every sentence in that exchange was true and the outcome was still a bait-and-switch: after a
// page naming a business, "please hold while I connect you" means *holding for that business*.
// The rule was already written — `lib/ppl/cascade.ts` says never imply the caller has reached the
// company whose site they rang — but it was written for the cascade, which is flag-gated OFF,
// while the single forward that has been live all along did exactly what it forbids.
//
// So: NAME THE BUSINESS WE ARE ABOUT TO DIAL, BEFORE WE DIAL IT. Then the business answering as
// itself CONFIRMS the announcement instead of contradicting it. That is the whole fix, and it
// turns a hang-up into a job for everyone involved — the deception had no beneficiary.
//
// ⚠️ The name must come from the DESTINATION (a real business we resolved from its phone number),
// never from the site. If we cannot resolve a name we say "a local towing company" — vague but
// true — and NEVER fall back to the site's invented identity, which is the failure restored.

/** Legal suffixes and trailing locality fragments that make a real name clumsy when spoken. */
const LEGAL_SUFFIX = /[\s,]+(l\.?l\.?c\.?|inc\.?|incorporated|co\.?|corp\.?|ltd\.?|p\.?l\.?l\.?c\.?)$/i;
const TRAILING_LOCALITY = /\s*,\s*[A-Za-z .'-]+\s*,\s*[A-Z]{2}\s*$/;

/**
 * Tidy a registered business name for text-to-speech WITHOUT changing which business it names.
 * Directory names arrive like `Ken's Auto Rescue , Kennewick, WA` and `Too Cool Towing LLC`.
 * Only trailing noise is removed — never a word that distinguishes one business from another.
 */
export function spokenBusinessName(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim();
  s = s.replace(TRAILING_LOCALITY, '');
  s = s.replace(LEGAL_SUFFIX, '');
  return s.replace(/\s*,\s*$/, '').trim();
}

export type AnnouncementArgs = {
  /** The REAL business we are about to dial, if we resolved one. Never the site's name. */
  businessName?: string | null;
  /** Lower-case trade noun, e.g. "towing" / "electrical". */
  trade?: string | null;
  /** The city the site targets, e.g. "South Hill". */
  city?: string | null;
};

/**
 * One sentence pair: who is about to answer, and that they are local to the city.
 *
 * Shape (name known):    "Thanks for calling. Connecting you now with Too Cool Towing, a local
 *                         towing company serving South Hill."
 * Shape (name unknown):  "Thanks for calling. Connecting you now with a local towing company
 *                         serving South Hill."
 */
export function connectingAnnouncement(args: AnnouncementArgs): string {
  const trade = (args.trade ?? '').trim().toLowerCase();
  const city = (args.city ?? '').trim();
  const name = args.businessName ? spokenBusinessName(args.businessName) : '';

  // "a local towing company" / "a local company" when we have no trade word.
  const descriptor = trade && trade !== 'local' ? `a local ${trade} company` : 'a local company';
  const serving = city ? ` serving ${city}` : '';
  const who = name ? `${name}, ${descriptor}${serving}` : `${descriptor}${serving}`;

  return `Thanks for calling. Connecting you now with ${who}.`;
}

/**
 * Phrases this announcement may never contain. Distinct from `FORBIDDEN_IVR_PHRASES` (claims
 * about a business) — these are the ways copy implies the caller reached the site's own company.
 */
export const FORBIDDEN_ANNOUNCEMENT_PHRASES = [
  // The sentence that caused the hang-up: a bare hold with no named destination.
  'please hold while i connect you',
  // Any greeting that asserts the caller arrived somewhere.
  "you've reached",
  'you have reached',
  'thank you for calling our',
  // Our own dispatch we do not operate.
  'our team',
  'our crews',
  'our dispatch',
];
