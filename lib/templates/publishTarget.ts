// lib/templates/publishTarget.ts
//
// Which row does "publish" actually write to?
//
// ⚠️ THE ANSWER WAS "NONE" FOR 1,376 SITES, AND THE UI SAID THEY WERE PUBLISHED.
//
// A template family is {canonical} ∪ {versions}, keyed by `base_slug`, and publish flips the
// pointer on the canonical (`is_version = false`). But `base_slug_of()` strips one trailing
// 4–5 char token, because that is the shape of the random suffix the app generates with
// `Math.random().toString(36).slice(2,7)`. It cannot distinguish that suffix from a site whose
// slug simply ends that way — so `renton-lemonade-fxny` bases to `renton-lemonade` and is
// stamped a *version* of a canonical that was never created, because it was never a version of
// anything. The canonical lookup then matched zero rows and the route 404'd.
//
// Measured on the live DB (2026-08-15): 2,582 slugged rows carry `is_version = true`; 1,376 of
// them have no canonical sibling at all.
//
// The failure was invisible because `templates.published` is not the only publish record — the
// domain panel's path writes `published_sites`, and that succeeded. So the settings panel read
// "published" from one table while the templates list read "draft" from the other, and both
// were honestly reporting what they saw.

export type PublishRow = {
  id: string;
  owner_id: string | null;
  slug: string | null;
};

/**
 * Pick the row to mark published: the family's canonical when one exists, otherwise the row
 * itself — a slugged row with no canonical sibling IS the canonical for its own URL.
 *
 * Returns null when neither applies. A slug-less row has no URL to be canonical at, so it
 * stays unpublishable; that is the one case where refusing is correct.
 */
export function resolvePublishTarget<T extends PublishRow>(
  canonical: T | null | undefined,
  self: T | null | undefined,
): T | null {
  if (canonical) return canonical;
  if (self && typeof self.slug === 'string' && self.slug.trim() !== '') return self;
  return null;
}
