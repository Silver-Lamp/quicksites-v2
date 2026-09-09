// lib/sites/baseSlug.ts
//
// `grandstead-towing-service.quicksites.ai` instead of `grandstead-towing-service-5v2qe.quicksites.ai`.
//
// Every auto-built slug carries a random 5-char tail so two builds never collide, and every
// template row carries a trigger-maintained `base_slug` with that tail stripped (CLAUDE.md §8).
// A postcard printing the tailed host is honest but onerous to type; the bare host is what a
// person would guess. Two rules, both pure so they can be pinned:
//
//  • RESOLVE (the public route): a host that matches no template's `slug` but matches some
//    templates' `base_slug` serves the newest PUBLISHED one, else the newest draft. "Latest
//    published" is what the owner asked for; a draft is served only when nothing is published.
//
//  • PRINT (the card): the bare host is printed only when every template sharing the base is the
//    SAME business (the fleet's shared bases are all a legacy row and its re-found twin). Two
//    different shops with the same name would otherwise race for one host, and a card is the one
//    surface we cannot correct after it prints — so those keep the tailed slug. The send loop then
//    preflights the printed URL, so a bare host that does not resolve never reaches paper.
export type BaseSlugRow = {
  id: string;
  slug: string;
  base_slug: string | null;
  business_name?: string | null;
  published?: boolean | null;
  created_at: string;
};

const norm = (s: unknown) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Newest published template for a base, else the newest draft; null when there are none. */
export function pickTemplateForBase<T extends BaseSlugRow>(rows: T[]): T | null {
  if (!rows.length) return null;
  const byNewest = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return byNewest.find((r) => r.published) ?? byNewest[0];
}

/**
 * The slug a card may print for `template`: its base when the bare host would resolve to THIS
 * template and every sibling sharing the base is the same business; else its full slug.
 */
export function printableSlug<T extends BaseSlugRow>(template: T, siblings: T[]): string {
  const base = (template.base_slug ?? '').trim();
  if (!base || base === template.slug) return template.slug;
  const family = siblings.filter((s) => s.base_slug === base);
  if (!family.some((s) => s.id === template.id)) return template.slug; // caller passed the wrong family
  const names = new Set(family.map((s) => norm(s.business_name)));
  if (names.size > 1) return template.slug; // two different shops — nobody gets the bare host
  const pick = pickTemplateForBase(family);
  return pick?.id === template.id ? base : template.slug;
}
