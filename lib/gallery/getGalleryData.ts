// lib/gallery/getGalleryData.ts
//
// Every industry we build for, with a real published example of each.
//
// ⚠️ THE EXAMPLES ALREADY EXISTED. Asked for a gallery "including the new creative ones", the
// instinct was to go and seed sites. Measured first: **all 60 offered industries already have
// at least one published site** — 61 distinct industry values across the live fleet. Nothing
// needed seeding. The gap was that no page showed them. Fifth instance this week of a
// capability that exists and is unreachable (gallery block, font pairings, `themeId`,
// `surface`), and the only one where checking saved building the wrong thing entirely.
//
// ⚠️ NO `is_version = false` FILTER, DELIBERATELY, AND THIS IS THE DOCUMENTED TRAP.
// `getShowcaseData` carries one with a standing comment saying it "silently drops most of the
// fleet" and is harmless only because every curated homepage slug happens to be
// `is_version = false`. It is NOT harmless here: `personal` has 6 published sites and only 2
// would survive it, and the identical filter once reduced the public restaurant directory
// (`app/delivered/page.tsx`) to a single placeholder. A grouped-by-industry page is exactly the
// reader that trap was waiting for. `is_version` does not reliably mean "version snapshot" — a
// fresh create gets `true` — so it cannot be used to mean "real site".
//
// ⚠️ THESE ARE EXAMPLES, NOT CUSTOMERS, AND THE PAGE MUST SAY SO. 31 of the published towing
// sites are unclaimed geo pitch sites built from public listings; nobody is paying for them and
// several name businesses that do not exist. They are genuinely our work and fine to show as
// *what we build*. Presenting them as clients would be a false claim about our book, so the
// copy says "examples" and the type carries no customer language.

import { getServerSupabase } from '@/lib/supabase/server';
import { INDUSTRIES, KEY_TO_LABEL, type IndustryKey } from '@/lib/industries';
import { looksLikeDemo } from '@/lib/home/getShowcaseData';
import { firstNonEmpty, prettifySlug } from '@/lib/home/showcase-helpers';

export type GalleryExample = {
  slug: string;
  name: string;
  /** Public URL for the example. */
  href: string;
  /** Thumbnail endpoint — generated, so an example with no hero still shows something. */
  thumb: string;
};

export type GalleryGroup = {
  key: string;
  label: string;
  /** Surfaced first on the page. */
  creative: boolean;
  examples: GalleryExample[];
};

export type GalleryData = {
  groups: GalleryGroup[];
  /** Industries we offer that have no published example — shown as honest gaps, not hidden. */
  missing: string[];
  totalExamples: number;
};

/**
 * The verticals the gallery leads with (owner, 2026-10-02: "authors photographers and
 * creatives"). Not a judgement about the others — it is where the current work is aimed.
 */
export const CREATIVE_INDUSTRIES = new Set<string>([
  'photography', 'author', 'personal', 'crafts', 'handmade', 'artisan_goods',
  'art_supplies', 'etsy_style', 'custom_apparel', 'print_on_demand', 'gifts_stationery',
]);

/** How many examples to show per industry before "+N more". */
export const PER_INDUSTRY = 3;

export async function getGalleryData(): Promise<GalleryData> {
  const supa = await getServerSupabase({ serviceRole: true });

  // ⚠️ Paged: PostgREST caps a response at 1000 rows whatever `.limit()` says, and a capped
  // read looks exactly like a small fleet (the font backfill reported 566 of 1000 against a
  // 3,231-row table before this was fixed there).
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await (supa as any)
      .from('templates')
      .select('slug, business_name, template_name, industry, industry_label, data, claim_source, custom_domain, updated_at')
      .eq('published', true)
      .eq('archived', false)
      .eq('is_site', true)
      .order('updated_at', { ascending: false })
      .range(from, from + 999);
    if (error) break; // a partial gallery beats no page; the groups simply carry fewer examples
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) break;
  }

  const byIndustry = new Map<string, GalleryExample[]>();
  for (const r of rows) {
    if (!r.slug) continue;
    if (looksLikeDemo(r)) continue; // a demo dressed as a customer is not an example of our work
    const key = String(r.data?.meta?.industry ?? r.industry ?? '').trim();
    if (!key) continue;
    const list = byIndustry.get(key) ?? [];
    list.push({
      slug: r.slug,
      name: firstNonEmpty(r.business_name, r.template_name) ?? prettifySlug(r.slug),
      // Always the platform URL. A custom domain can lapse or be re-pointed while the template
      // stays published, and a gallery full of dead links is worse than a plain one.
      href: `/sites/${r.slug}`,
      thumb: `/api/public/showcase/${encodeURIComponent(r.slug)}/thumb`,
    });
    byIndustry.set(key, list);
  }

  const groups: GalleryGroup[] = [];
  const missing: string[] = [];
  let totalExamples = 0;

  for (const { key } of INDUSTRIES) {
    const all = byIndustry.get(key) ?? [];
    if (all.length === 0) {
      // ⚠️ Reported rather than hidden. A gallery that silently omits what it cannot show
      // reads as complete coverage, which is a claim nobody checked.
      missing.push(KEY_TO_LABEL[key as IndustryKey] ?? key);
      continue;
    }
    const examples = all.slice(0, PER_INDUSTRY);
    totalExamples += examples.length;
    groups.push({
      key,
      label: KEY_TO_LABEL[key as IndustryKey] ?? key,
      creative: CREATIVE_INDUSTRIES.has(key),
      examples,
    });
  }

  // Creative first (where the current work is aimed), then alphabetical within each band.
  groups.sort((a, b) =>
    a.creative === b.creative ? a.label.localeCompare(b.label) : a.creative ? -1 : 1,
  );

  return { groups, missing, totalExamples };
}
