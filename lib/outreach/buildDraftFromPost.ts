// lib/outreach/buildDraftFromPost.ts
//
// "Build from a post": a site for someone who announced a sale in a Facebook group — a product
// with a price, a time and a place, photos, their own words. River Williams's smoked-salmon page
// (2026-10-10) was built by hand this way the night before his pop-up and drew real traffic;
// this is that recipe as a function, so the next one is a form instead of a script.
//
// ⚠️ ONLY WHAT THEY SAID. The input is the person's own words, items, prices and photos, typed
// by an operator from the post. The scaffold blocks that would speak for them — FAQ, services,
// contact form, order bar, CTA, the silent audio block — are stripped; nothing is generated.
// The menu is stamped `sourced_at` so the prices they posted show (a price they published
// today is a dated price). The draft is operator-owned, claim_source='listing_import', so the
// claim flow and the delivered.menu watermark apply until they take it.
//
// ⚠️ ADULTS ONLY, BY DECLARATION. The operator confirms the seller is an adult; a child's stand
// is the lemonade vertical with the parent, and no minor's voice or likeness goes on a page.

import { supabaseAdmin } from '@/lib/supabase/admin';
import { buildRebuildTemplate } from '@/lib/rebuild/assembleDraft';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import { mintSiteClaimToken } from '@/lib/auth/siteClaimToken';
import type { RebuildSpec, HoursDaySpec } from '@/lib/rebuild/inferSiteSpec';

export type PostItem = { name: string; price?: string; description?: string };
export type PostPhoto = { url: string; alt?: string };
export type PostHours = { day: HoursDaySpec['day']; open: string; close: string };

export type PostSpec = {
  businessName: string;
  /**
   * What is being sold. `food` keeps the restaurant chrome (menu, "View Menu", the order-ahead
   * claim pitch). `goods` — a decor sale, a garage sale, a maker's table — keeps the same
   * blocks but none of the food wording, and is filed under a non-food industry so the public
   * render shows no "Order online?" pill and no "take online orders" promise.
   */
  kind?: 'food' | 'goods' | 'services';
  /** Industry the row is filed under for a non-food kind; defaults per kind (see NON_FOOD_INDUSTRY). */
  industry?: string;
  /** The post, as written. Becomes the about text. */
  words: string;
  headline: string;
  subheadline?: string;
  sectionName: string;
  items: PostItem[];
  menuNote?: string;
  /** Where, and the number they published for orders — only when the post itself carries it. */
  where?: { address?: string; city?: string; state?: string; phone?: string };
  hours?: PostHours[];
  story?: { heading: string; body: string }[];
  photos: PostPhoto[];
  /**
   * Whether the first photo becomes the hero image (default true). False when the only photo
   * is a document — a price card, a flyer — which the hero would crop to a slice; the photos
   * then go to the gallery and story panels only.
   */
  heroPhoto?: boolean;
  /** Where the words came from — kept on meta so a reviewer can see the provenance. */
  sourceNote: string;
  /** The operator's declaration; the builder refuses without it. */
  sellerIsAdult: boolean;
  /** Who is this for (first name is enough) — the DM draft addresses them. */
  firstName?: string;
};

export const STRIPPED_BLOCKS = ['faq', 'services', 'contact_form', 'order_bar', 'about_that', 'cta', 'testimonials'] as const;
/** The industry a non-food kind is filed under by default: `needsMenu()` is false for each, so the food chrome stays off. */
export const NON_FOOD_INDUSTRY = { goods: 'pop_up_shop', services: 'other' } as const;
/** @deprecated kept for the first goods build; use NON_FOOD_INDUSTRY */
export const GOODS_INDUSTRY = NON_FOOD_INDUSTRY.goods;
/** The chrome words per non-food kind: the hero button, the nav item that replaces "Menu", the location heading. */
export const NON_FOOD_COPY = {
  goods: { cta: "See what's for sale", nav: 'For sale', where: 'Where' },
  services: { cta: 'See prices', nav: 'Prices', where: 'Where' },
} as const;
export const GOODS_COPY = NON_FOOD_COPY.goods;
export const ALLOWED_BLOCKS = new Set(['hero', 'menu', 'location', 'hours', 'story', 'gallery', 'header', 'footer']);

const DAYS: HoursDaySpec['day'][] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || 'site';
}

/** Pure: the post → the rebuild spec the assembler takes. Every string is the person's. */
export function postToRebuildSpec(p: PostSpec): RebuildSpec {
  const items = p.items.filter((i) => i.name?.trim());
  const hours: HoursDaySpec[] | undefined = p.hours?.length
    ? DAYS.map((d) => {
        const h = p.hours!.find((x) => x.day === d);
        return h ? { day: d, open: h.open, close: h.close } : { day: d, closed: true };
      })
    : undefined;
  return {
    businessName: p.businessName.trim(),
    industryKey: 'restaurant',
    industryLabel: p.sectionName.trim() || 'Food',
    headline: p.headline.trim(),
    subheadline: (p.subheadline ?? '').trim(),
    about: p.words.trim(),
    services: [],
    faqs: [],
    menu: items.length ? { sections: [{ name: p.sectionName.trim() || 'For sale', items: items.map((i) => ({ name: i.name.trim(), ...(i.description?.trim() ? { description: i.description.trim() } : {}), ...(i.price?.trim() ? { price: i.price.trim() } : {}) })) }] } : undefined,
    contact: p.where && (p.where.address || p.where.city || p.where.phone) ? { address: p.where.address?.trim() || undefined, city: p.where.city?.trim() || undefined, state: p.where.state?.trim() || undefined, phone: p.where.phone?.trim() || undefined } : undefined,
    hours,
    seoTitle: p.headline.trim() ? `${p.businessName.trim()} — ${p.headline.trim()}` : p.businessName.trim(),
    seoDescription: (p.subheadline ?? p.words).trim().slice(0, 160),
    story: p.story?.filter((s) => s.heading?.trim() && s.body?.trim()).map((s) => ({ heading: s.heading.trim(), body: s.body.trim() })),
  };
}

/** Pure: assemble the template data with the scaffold's speaking blocks removed and the photos in. */
export function assemblePostTemplate(p: PostSpec) {
  const spec = postToRebuildSpec(p);
  const photos = p.photos.filter((x) => /^https:\/\//.test(x.url));
  const useHero = p.heroPhoto !== false;
  const tpl = buildRebuildTemplate({ spec, heroImage: useHero ? photos[0]?.url ?? null : null, sourceUrl: null, galleryImages: (useHero ? photos.slice(1) : photos).map((x) => x.url), colorMode: 'dark' });
  // ⚠️ The scaffold's hours and location blocks carry PLACEHOLDER days and an empty map when the
  // spec gives none — on a one-off sale with no weekly schedule that is an invented schedule
  // under a real person's name. No hours typed → no hours block; no STREET address → no
  // location block (a city alone still reaches the footer, but a map of a whole town is not a
  // place to go).
  const strip = new Set<string>(STRIPPED_BLOCKS);
  if (!spec.hours) strip.add('hours');
  if (!spec.contact?.address) strip.add('location');
  const nonFood = p.kind === 'goods' || p.kind === 'services' ? p.kind : null;
  const goods = nonFood !== null;
  const words = nonFood ? NON_FOOD_COPY[nonFood] : null;
  for (const pg of tpl.data.pages ?? []) {
    for (const key of ['blocks', 'content_blocks'] as const) {
      if (!Array.isArray(pg[key])) continue;
      pg[key] = pg[key].filter((b: any) => !strip.has(b?.type));
      for (const b of pg[key]) {
        for (const c of [b?.content, b?.props]) {
          if (!c) continue;
          if (b.type === 'menu') {
            c.sourced_at = new Date().toISOString();
            if (p.menuNote?.trim()) c.note = p.menuNote.trim();
            // The block heading is the nav word ("Prices" / "For sale"); the typed section name
            // is the section inside it — using it for both printed the same line twice.
            if (words) c.title = words.nav;
          }
          if (words && b.type === 'hero' && typeof c.cta_text === 'string') c.cta_text = words.cta;
          if (words && b.type === 'location' && typeof c.title === 'string') c.title = words.where;
        }
      }
      if (photos.length) {
        const gallery: any = createDefaultBlock('gallery');
        gallery.content = { ...(gallery.content ?? {}), title: 'Photos', columns: 2, images: photos.map((x) => ({ url: x.url, alt: x.alt ?? '' })) };
        const storyIdx = pg[key].findIndex((b: any) => b?.type === 'story');
        pg[key].splice(storyIdx >= 0 ? storyIdx + 1 : pg[key].length, 0, gallery);
      }
    }
  }
  tpl.data.meta = { ...(tpl.data.meta ?? {}), built_from_post: true, post_kind: nonFood ?? 'food', source_note: p.sourceNote.trim(), built_for: p.businessName.trim() };
  if (nonFood && words) {
    // Filed under a non-food industry everywhere the render looks (row column, data, meta), and
    // the restaurant scaffold's "Menu" nav relabelled in the header and footer.
    const industry = (p.industry?.trim() || NON_FOOD_INDUSTRY[nonFood]) as string;
    tpl.industry = industry;
    if (tpl.data && typeof tpl.data === 'object') {
      if ('industry' in tpl.data) tpl.data.industry = industry;
      if (tpl.data.meta && 'industry' in tpl.data.meta) tpl.data.meta.industry = industry;
    }
    for (const blk of [tpl.header_block, tpl.footer_block, tpl.data?.headerBlock, tpl.data?.footerBlock]) {
      for (const c of [blk?.content, blk?.props]) {
        for (const item of c?.nav_items ?? c?.links ?? []) {
          if (item?.label === 'Menu') item.label = words.nav;
          if (item?.label === 'Location & Hours') item.label = words.where;
        }
      }
    }
  }
  // A nav item pointing at a block that was stripped is a dead anchor; drop it in header + footer.
  const stripped = new Set(Array.from(strip).map((t) => `#${t}`));
  for (const blk of [tpl.header_block, tpl.footer_block, tpl.data?.headerBlock, tpl.data?.footerBlock]) {
    for (const c of [blk?.content, blk?.props]) {
      if (!c) continue;
      for (const key of ['nav_items', 'links'] as const) {
        if (Array.isArray(c[key])) c[key] = c[key].filter((item: any) => !stripped.has(String(item?.href ?? '')));
      }
    }
  }
  return tpl;
}

export type PostBuildResult = { id: string; slug: string; previewUrl: string; platformUrl: string; claimUrl: string; blocks: string[] };

export class PostBuildError extends Error {
  code: 'not_adult' | 'insert_failed' | 'invalid';
  constructor(code: PostBuildError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'PostBuildError';
  }
}

export async function buildDraftFromPost(p: PostSpec, operatorId: string, base = 'https://www.quicksites.ai', menuHost: string | null = null): Promise<PostBuildResult> {
  if (!p.sellerIsAdult) throw new PostBuildError('not_adult', 'The seller must be confirmed an adult.');
  if (!p.businessName?.trim() || !p.words?.trim() || !p.headline?.trim()) throw new PostBuildError('invalid', 'Name, their words and a headline are required.');
  const tpl = assemblePostTemplate(p);
  let slug: string = (tpl as any).slug || slugify(p.businessName);
  let insertedId: string | null = null;
  for (let attempt = 0; attempt < 3 && !insertedId; attempt++) {
    const row: any = {
      id: globalThis.crypto.randomUUID(),
      template_name: attempt === 0 ? tpl.template_name : `${tpl.template_name} ${attempt + 1}`,
      slug,
      data: tpl.data,
      color_mode: tpl.color_mode,
      header_block: tpl.header_block,
      footer_block: tpl.footer_block,
      is_site: false,
      industry: tpl.industry,
      business_name: tpl.business_name,
      owner_id: operatorId,
      claim_source: 'listing_import',
    };
    const { data, error } = await supabaseAdmin.from('templates').insert(row).select('id, slug').single();
    if (!error && data) { insertedId = data.id; slug = data.slug; break; }
    if (error && `${error.code}` === '23505') { slug = `${slugify(p.businessName)}-${Math.random().toString(36).slice(2, 5)}`; continue; }
    throw new PostBuildError('insert_failed', error?.message || 'Could not save the draft.');
  }
  if (!insertedId) throw new PostBuildError('insert_failed', 'Could not allocate a unique slug.');
  const b = base.replace(/\/+$/, '');
  return {
    id: insertedId,
    slug,
    previewUrl: menuHost ? `https://deliveredmenu.com/${slug}` : `${b}/sites/${slug}`,
    platformUrl: `${b}/sites/${slug}`,
    // Minted HERE, on the server that will verify it — a token minted elsewhere reads "expired".
    claimUrl: `${b}/claim-site/${insertedId}?token=${encodeURIComponent(mintSiteClaimToken(insertedId))}`,
    blocks: (tpl.data.pages?.[0]?.blocks ?? []).map((x: any) => String(x.type)),
  };
}

/** The message the operator sends. Plain, honest, with the exit stated. Held to the forbidden list by test. */
export function postBuildDm(input: { firstName: string; senderName: string; previewUrl: string; claimUrl: string; context?: string }): string {
  const name = input.firstName.trim() || 'there';
  return (
    `Hey ${name} — ${input.senderName} here. ${input.context?.trim() ? `${input.context.trim()} ` : ''}I build simple websites for small local businesses, so I put one together for you from your own post and photos:\n\n` +
    `${input.previewUrl}\n\n` +
    `It has what you listed at the prices you posted, the time and place, and your pictures. Nothing on it that you didn't say.\n\n` +
    `It's yours, free, no catch. If you want to edit it or add a way for people to pay ahead for pickup, this link makes it your account (takes about 2 minutes):\n\n` +
    `${input.claimUrl}\n\n` +
    `That link is just for you, so don't post it. If you'd rather it not exist, say the word and I'll take it down the same day.`
  );
}
