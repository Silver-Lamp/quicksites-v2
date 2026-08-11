// lib/outreach/voiceSources.ts
//
// Where to go to hear a business speak in its own words.
//
// ⚠️ THE POINT IS THE VOICE, NOT THE FACTS. We already scraped their name, address, hours and
// menu — the pipeline is good at facts. What it cannot produce is how the owner writes: whether
// they say "family recipe" or "house special", whether the reviews all mention one dish, whether
// their Facebook posts are warm or terse. Rewriting one line in that voice is the whole manual
// step (docs/OUTREACH_FIVE.md), and it fails on friction — if finding the sources takes five
// minutes per business, the step gets skipped and the outreach becomes the automated version
// wearing a human's name.
//
// ⚠️ SEARCHES, NOT GUESSED PROFILE URLS — THIS IS THE ONE RULE THAT MATTERS HERE. It is trivial to
// construct `yelp.com/biz/<slugified-name>` or `facebook.com/<name>`, and roughly as likely to
// land on a DIFFERENT business as on the right one. A fabricated profile link is the same defect
// as a fabricated `sameAs` entry (lib/seo/personSchema.ts): a URL nobody verified, presented as
// this business's. Worse here, because an operator would then read a stranger's reviews and write
// "their voice" from them.
//
// So every link below is either:
//   - EXACT — built from an identifier the business actually has (a Google place id), or
//   - a SEARCH — a query we are honestly performing, where the operator sees the result set and
//     picks. A search URL claims nothing.
//
// The distinction is carried in the type so the UI can show it, rather than left to the reader.

export type VoiceSource = {
  label: string;
  href: string;
  /** `exact` = built from a real identifier · `search` = a query the operator resolves. */
  kind: 'exact' | 'search';
  /** Why this one is worth opening — shown as a tooltip, not decoration. */
  hint: string;
};

function q(...parts: (string | null | undefined)[]): string {
  return encodeURIComponent(parts.filter(Boolean).join(' ').trim());
}

/**
 * Sources for one business, most useful first.
 *
 * Ordering is deliberate: reviews before social, because a review quotes the DISH names customers
 * actually use, which is the vocabulary most worth borrowing. Their own site last — these are
 * no-website businesses, so it is usually absent and a dead entry at the top reads as breakage.
 */
export function voiceSourcesFor(data: any): VoiceSource[] {
  const meta = data?.meta ?? {};
  const contact = meta.contact ?? {};
  const name: string = String(meta.business_name ?? meta.siteTitle ?? '').trim();
  if (!name) return [];

  const city = String(contact.city ?? '').trim();
  const region = String(contact.state ?? '').trim();
  const address = String(contact.address ?? '').trim();
  const place = [city, region].filter(Boolean).join(', ');
  const placeId = typeof meta.source_place_id === 'string' ? meta.source_place_id.trim() : '';

  const out: VoiceSource[] = [];

  // Exact when we kept the place id at import (scripts/import-listings-batch.ts stamps it);
  // otherwise a maps search on name + address, which resolves to the same pin in practice but
  // is honestly labelled as a search.
  out.push(
    placeId
      ? {
          label: 'Google listing',
          href: `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}`,
          kind: 'exact',
          hint: 'The exact listing this draft was built from.',
        }
      : {
          label: 'Google listing',
          href: `https://www.google.com/maps/search/?api=1&query=${q(name, address || place)}`,
          kind: 'search',
          hint: 'Maps search — confirm it is the right pin before quoting anything.',
        },
  );

  out.push({
    label: 'Reviews',
    href: `https://www.google.com/search?q=${q(name, place, 'reviews')}`,
    kind: 'search',
    hint: 'Customers name dishes the way locals say them — the best vocabulary source.',
  });

  out.push({
    label: 'Yelp',
    href: `https://www.yelp.com/search?find_desc=${q(name)}&find_loc=${q(place)}`,
    kind: 'search',
    hint: 'Owner replies to reviews are often the only long-form thing they have written.',
  });

  out.push({
    label: 'Facebook',
    href: `https://www.facebook.com/search/top?q=${q(name, place)}`,
    kind: 'search',
    hint: 'Specials and closures, posted in their own words.',
  });

  out.push({
    label: 'Instagram',
    href: `https://www.google.com/search?q=${q('site:instagram.com', name, city)}`,
    kind: 'search',
    hint: 'Photos of the actual food, with their captions.',
  });

  out.push({
    label: 'News / blogs',
    href: `https://www.google.com/search?q=${q(`"${name}"`, city, '-site:yelp.com', '-site:tripadvisor.com')}`,
    kind: 'search',
    hint: 'A local write-up sometimes quotes the owner directly.',
  });

  // Only when they actually have one. These are no-website businesses by construction, so this is
  // usually absent — and an always-present dead link would be worse than no link.
  const site = typeof meta.source_url === 'string' ? meta.source_url.trim() : '';
  if (site) {
    out.push({ label: 'Their site', href: site, kind: 'exact', hint: 'Their own words, unmediated.' });
  }

  return out;
}
