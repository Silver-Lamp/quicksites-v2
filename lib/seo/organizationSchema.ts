// lib/seo/organizationSchema.ts
//
// Organization JSON-LD for the QuickSites homepage — the "this is who we are" record that tells
// a search engine which entity owns this brand name.
//
// ⚠️ WHY THIS EXISTS, WITH THE NUMBER THAT PROMPTED IT. Query-level Search Console shows we sit
// at **average position 12.3 for the query "quicksites"** — our own brand name — on 663
// impressions. Page two, for the one query where we are by definition the correct answer.
//
// The diagnosis is narrower than it first looked. 7.4% CTR reads low against branded
// benchmarks, but those assume position 1; at position ~12 the positional average is 1–2%, so
// we're getting roughly 4x it. People who see us click — some of them scrolling to page two to
// do it. **It is a ranking problem and only a ranking problem**, which rules out the whole
// class of snippet fixes (rewriting titles, meta descriptions) and points at entity signals.
// (Correction courtesy of PorchHearth; I had originally called the CTR low.)
//
// ⚠️ AND IT IS NOT EVIDENCE ABOUT quicksite.ai. Who occupies positions 1–11 is unmeasured —
// candidates include a same-named competitor, QuickSite.space, Quicksite ltd, and the plain fact
// that "quick site" is a phrase every builder's marketing uses. This fixes the symptom we can
// see; it asserts nothing about the cause, and it is the right move regardless of the cause.
//
// Deliberately minimal and fact-only: name, URL, logo, description, and sameAs links that
// actually exist. Structured data is a machine-readable claim about a real entity, so every
// field here has to be true — an invented sameAs or a fabricated founding date is the same class
// of dishonesty as a fabricated review, aimed at a crawler instead of a person.

/** The canonical origin. Trailing slash omitted so callers can append paths cleanly. */
export const CANONICAL_ORIGIN = 'https://www.quicksites.ai';

export type OrganizationSchemaOptions = {
  /** Profiles that verifiably belong to us. Omit rather than guess — see the note above. */
  sameAs?: string[];
};

export function organizationSchema(opts: OrganizationSchemaOptions = {}) {
  const sameAs = (opts.sameAs ?? []).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'QuickSites',
    // `alternateName` earns its place on a branded-query problem: people type the singular, and
    // this is the honest way to say "that's also us" without claiming anyone else's name.
    alternateName: 'QuickSites.ai',
    url: `${CANONICAL_ORIGIN}/`,
    logo: `${CANONICAL_ORIGIN}/brand/qs-mark.png`,
    description:
      'QuickSites builds a website, an online store and a customer CRM for local businesses — free to build and host, with a small fee only on the orders you sell.',
    ...(sameAs.length ? { sameAs } : {}),
  } as const;
}

/** Ready-to-embed JSON for a <script type="application/ld+json"> tag. */
export function organizationSchemaJson(opts?: OrganizationSchemaOptions): string {
  return JSON.stringify(organizationSchema(opts));
}
