// lib/rebuild/assembleDraft.ts
//
// Turn a RebuildSpec (+ the scraped hero image) into a ready-to-insert QuickSites
// template payload. Reuses buildIndustryStarter for structure/theme, then injects
// the AI copy + hero the same way lib/builder/generateDemoSite.ts does — so a
// rebuilt draft opens in the editor as a working, on-brand site, not empty blocks.

import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import type { RebuildSpec } from '@/lib/rebuild/inferSiteSpec';
import { formatContactAddress } from '@/lib/rebuild/parseAddress';
import type { ProductSpec } from '@/lib/rebuild/importShopify';

export type RebuildTemplate = {
  template_name: string;
  slug: string;
  color_mode: 'light' | 'dark';
  data: any;
  header_block: any;
  footer_block: any;
  industry: string;
  business_name: string;
};

function slugify(s: string): string {
  return (
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 48) || 'site'
  );
}

function rand(): string {
  return Math.random().toString(36).slice(2, 7);
}

/** Assemble the template row payload for a rebuilt draft. Pure (no I/O). */
export function buildRebuildTemplate(opts: {
  spec: RebuildSpec;
  heroImage?: string | null;
  sourceUrl?: string | null;
  /** Extra images (product photos beyond the hero, scraped images) to illustrate
   *  the story sections. Ordered by preference. */
  galleryImages?: string[];
  /** The original site's detected color scheme — the rebuilt site matches it (so a
   *  light source site yields a light draft) instead of the industry default. */
  colorMode?: 'light' | 'dark';
}): RebuildTemplate {
  const { spec, heroImage, sourceUrl } = opts;

  const tpl: any = buildIndustryStarter({
    businessName: spec.businessName,
    industryKey: spec.industryKey,
  });

  // Match the source site's light/dark scheme when we detected one, overriding the
  // industry scaffold's default (which is dark). Keeps data.color_mode + the theme's
  // darkMode in sync so the render + editor agree.
  if (opts.colorMode) {
    tpl.color_mode = opts.colorMode;
    if (tpl.data) {
      tpl.data.color_mode = opts.colorMode;
      if (tpl.data.meta?.theme) tpl.data.meta.theme.darkMode = opts.colorMode;
    }
  }

  // Inject AI copy + hero into the first (hero) block. For a store we lead the hero
  // with the real product photo when we didn't get a better (scraped/generated) one.
  const page = tpl.data?.pages?.[0];
  const hero = page?.blocks?.[0];
  const effectiveHero = heroImage || spec.products?.[0]?.images?.[0] || null;
  if (hero?.content) {
    if (spec.headline) hero.content.headline = spec.headline;
    if (spec.subheadline) hero.content.subheadline = spec.subheadline;
    if (effectiveHero && Object.prototype.hasOwnProperty.call(hero.content, 'image_url')) {
      hero.content.image_url = effectiveHero;
    }
  }

  const blocks: any[] = tpl.data?.pages?.[0]?.blocks ?? [];

  // Real e-commerce products (e.g. Shopify import) → a live storefront grid. This is
  // the "replicate a Shopify site" path: real titles/prices/images instead of the
  // AI's generic services brochure. Catalog ids + merchant are wired in afterward by
  // wireCatalogIntoTemplate() once the catalog_items rows exist.
  if (spec.products?.length) {
    applyProductBlocks(blocks, spec.products);
  }

  // Brand storytelling → an alternating image+text `story` block. Pairs each AI story
  // point with a real image (product photos beyond the hero, or scraped images) so a
  // converted store reads like the original brand site, not just hero + grid.
  if (spec.story?.length) {
    const heroUrl = effectiveHero || undefined;
    const storyImages = (opts.galleryImages ?? []).filter((u) => u && u !== heroUrl);
    applyStoryBlock(blocks, spec.story, storyImages);
  }

  // If the AI reconstructed a real menu (restaurant conversion), replace the
  // scaffold's placeholder menu with it.
  if (spec.menu?.sections?.length) {
    const menuBlock = blocks.find((b) => b?.type === 'menu');
    if (menuBlock?.content) {
      menuBlock.content.title = menuBlock.content.title || 'Our Menu';
      menuBlock.content.sections = spec.menu.sections.map((s) => ({
        name: s.name,
        description: '',
        items: s.items.map((it) => ({
          name: it.name,
          description: it.description ?? '',
          price: it.price ?? '',
          tags: [],
        })),
      }));
    }
  }

  // Real contact info → the location block (address + tap-to-call + map).
  if (spec.contact) {
    const loc = blocks.find((b) => b?.type === 'location');
    if (loc?.content) {
      loc.content.business_name = loc.content.business_name || spec.businessName;
      if (spec.contact.address) {
        // Display + geocode use the FULL single-line address (reconstructed from the parsed
        // parts) so the map still resolves even though address/city/state/postal are split.
        const fullAddress = formatContactAddress(spec.contact);
        loc.content.address = fullAddress;
        loc.content.map_query = fullAddress;
      }
      if (spec.contact.phone) loc.content.phone = spec.contact.phone;
      if (spec.contact.email) loc.content.email = spec.contact.email;
    }
    // The sticky mobile bar's tap-to-call uses the same number.
    if (spec.contact.phone) {
      const bar = blocks.find((b) => b?.type === 'order_bar');
      if (bar?.content) bar.content.phone = spec.contact.phone;

      // Footer gets a tap-to-call link too — desktop visitors don't see the sticky
      // bar, and "call the restaurant" is the #1 footer job on a restaurant site.
      const digits = spec.contact.phone.replace(/[^\d+]/g, '');
      const footerBlk =
        (tpl as any)?.data?.footerBlock ?? (tpl as any)?.footerBlock ?? (tpl as any)?.footer_block;
      if (digits && footerBlk?.content && Array.isArray(footerBlk.content.links)) {
        const hasTel = footerBlk.content.links.some((l: any) =>
          String(l?.href || '').startsWith('tel:')
        );
        if (!hasTel) {
          footerBlk.content.links.push({
            label: `Call ${spec.contact.phone}`,
            href: `tel:${digits}`,
            appearance: 'default',
          });
        }
      }
    }
  }

  // Real hours → the hours block days.
  if (spec.hours?.length) {
    const hoursBlock = blocks.find((b) => b?.type === 'hours');
    if (hoursBlock?.content) {
      const LABEL: Record<string, string> = {
        mon: 'Mon',
        tue: 'Tue',
        wed: 'Wed',
        thu: 'Thu',
        fri: 'Fri',
        sat: 'Sat',
        sun: 'Sun',
      };
      hoursBlock.content.days = spec.hours.map((h) => ({
        key: h.day,
        label: LABEL[h.day] ?? h.day,
        closed: !!h.closed,
        periods: h.closed || !h.open || !h.close ? [] : [{ open: h.open, close: h.close }],
      }));
    }
  }

  const services = spec.services.length ? spec.services : tpl.services;
  tpl.services = services;
  tpl.data.services = services;
  // Mirror the real contact info into meta.contact — the footer renders address /
  // phone / map from here (template.data.meta.contact), NOT from the location block,
  // so without this the auto-built footer shows blanks even though "location" is filled.
  const metaContact: Record<string, string> = { ...(tpl.data?.meta?.contact ?? {}) };
  if (spec.contact?.address) metaContact.address = spec.contact.address;
  // Structured parts so the footer "Company Info" city/state/postal fields fill in.
  if (spec.contact?.address2) metaContact.address2 = spec.contact.address2;
  if (spec.contact?.city) metaContact.city = spec.contact.city;
  if (spec.contact?.state) metaContact.state = spec.contact.state;
  if (spec.contact?.postal) metaContact.postal = spec.contact.postal;
  if (spec.contact?.phone) metaContact.phone = spec.contact.phone;
  if (spec.contact?.email) metaContact.email = spec.contact.email;

  // Copy versions: keep the source site's VERBATIM original copy alongside the applied
  // AI copy so the editor can offer a per-block "revert to original" (v0 ↔ v1). Stored
  // in meta (a loose object that survives block-schema validation), not on block
  // content (which Zod may strip). Only present when we captured a real original.
  const copyVersions = buildCopyVersions(spec, services);

  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    business_name: spec.businessName,
    about: spec.about || null,
    services,
    faqs: spec.faqs ?? [],
    // Pre-pick the site type + industry so the editor's hero setup opens ready (no
    // "what kind of site?" re-ask). For an unmatched industry, seed the "Other" text
    // with the AI's label (e.g. "Card Game") so it's the appropriate category.
    site_type: 'small_business',
    industry: spec.industryKey,
    industry_label: spec.industryLabel,
    ...(spec.industryKey === 'other' && spec.industryLabel
      ? { industry_other: spec.industryLabel }
      : {}),
    ...(Object.keys(metaContact).length ? { contact: metaContact } : {}),
    ...(copyVersions ? { copy: copyVersions } : {}),
    // Provenance: mark this as a rebuild + where it came from (useful for the
    // editor banner + analytics; harmless to the renderer).
    rebuilt_from: sourceUrl || null,
    rebuild_source: 'ai_rebuild',
  };

  // SEO title/description: lead with the business name + locale so the auto-built site
  // ranks for brand + "<category> in <city>" searches. generateMetadata reads the
  // PAGE-level meta first (data.pages[0].meta), which the scaffold leaves unset — so
  // without this the <title> falls back to the page title "Home". Mirror into data.meta
  // too (siteTitle + LocalBusiness schema read from there).
  if (spec.seoTitle || spec.seoDescription) {
    if (spec.seoTitle) {
      tpl.data.meta.siteTitle = spec.seoTitle;
      tpl.data.meta.title = spec.seoTitle;
    }
    if (spec.seoDescription) tpl.data.meta.description = spec.seoDescription;
    const homePage = tpl.data?.pages?.[0];
    if (homePage) {
      homePage.meta = {
        ...(homePage.meta ?? {}),
        ...(spec.seoTitle ? { title: spec.seoTitle } : {}),
        ...(spec.seoDescription ? { description: spec.seoDescription } : {}),
      };
    }
  }

  return {
    template_name: spec.businessName,
    slug: `${slugify(spec.businessName)}-${rand()}`,
    color_mode: (tpl.color_mode ?? 'light') as 'light' | 'dark',
    data: tpl.data,
    header_block: tpl.data?.headerBlock ?? null,
    footer_block: tpl.data?.footerBlock ?? null,
    industry: spec.industryKey,
    business_name: spec.businessName,
  };
}

export type CopyField = {
  headline?: string;
  subheadline?: string;
  about?: string;
  services?: string[];
  faqs?: { q: string; a: string }[];
};
export type CopyVersions = { original: CopyField; generated: CopyField };

/**
 * Snapshot the original (source-site verbatim) vs generated (applied AI) copy so the
 * editor can revert per block. Returns null when there's no captured original — no
 * point offering a revert to nothing.
 */
export function buildCopyVersions(spec: RebuildSpec, services: string[]): CopyVersions | null {
  const o = spec.original;
  if (!o || !(o.headline || o.subheadline || o.about || o.services?.length || o.faqs?.length))
    return null;
  const original: CopyField = {
    ...(o.headline ? { headline: o.headline } : {}),
    ...(o.subheadline ? { subheadline: o.subheadline } : {}),
    ...(o.about ? { about: o.about } : {}),
    ...(o.services?.length ? { services: o.services } : {}),
    ...(o.faqs?.length ? { faqs: o.faqs } : {}),
  };
  const generated: CopyField = {
    ...(spec.headline ? { headline: spec.headline } : {}),
    ...(spec.subheadline ? { subheadline: spec.subheadline } : {}),
    ...(spec.about ? { about: spec.about } : {}),
    ...(services.length ? { services } : {}),
    ...(spec.faqs?.length ? { faqs: spec.faqs } : {}),
  };
  return { original, generated };
}

/**
 * Build a products_grid from real imported products and splice it into the page:
 * it replaces the storefront scaffold's empty grid if present, else the generic
 * "services" block, else lands right after the hero. Inline `products[]` are a
 * display snapshot for preview; the live `productIds` (wired later) drive the real
 * fetch + add-to-cart. Uses products_grid (not service_offer) even for one product
 * because only products_grid emits the cart events that make checkout work.
 */
function applyProductBlocks(blocks: any[], products: ProductSpec[]): void {
  const grid: any = createDefaultBlock('products_grid');
  grid.content = {
    ...grid.content,
    title: 'Shop',
    columns: Math.min(Math.max(products.length, 1), 3),
    productIds: [], // filled by wireCatalogIntoTemplate once catalog_items exist
    products: products.map((p) => ({
      // `id` is a placeholder (product handle) until the real catalog id is wired in.
      id: p.handle || slugify(p.title),
      title: p.title,
      price_cents: p.priceCents,
      image_url: p.images[0] ?? '',
      product_type: p.productType ?? null,
    })),
  };

  const gridIdx = blocks.findIndex((b) => b?.type === 'products_grid');
  const servicesIdx = blocks.findIndex((b) => b?.type === 'services');
  if (gridIdx >= 0) blocks[gridIdx] = grid;
  else if (servicesIdx >= 0) blocks[servicesIdx] = grid;
  else blocks.splice(1, 0, grid);
}

/**
 * Build a `story` block from AI story points, illustrated with real images (one per
 * section, in order; sections past the image count render text-only), and insert it
 * just before the FAQ/contact so the page flows hero → shop → story → faq → contact.
 */
function applyStoryBlock(
  blocks: any[],
  story: { heading: string; body: string }[],
  images: string[]
): void {
  const block: any = createDefaultBlock('story');
  block.content = {
    sections: story.map((s, i) => ({
      heading: s.heading,
      body: s.body,
      image_url: images[i] ?? '',
      cta_text: '',
      cta_link: '',
    })),
  };

  // Land before the FAQ, else before the contact form, else near the end (but keep it
  // above a trailing sticky order_bar).
  let idx = blocks.findIndex((b) => b?.type === 'faq');
  if (idx < 0) idx = blocks.findIndex((b) => b?.type === 'contact_form');
  if (idx < 0) {
    const barIdx = blocks.findIndex((b) => b?.type === 'order_bar');
    idx = barIdx >= 0 ? barIdx : blocks.length;
  }
  blocks.splice(idx, 0, block);
}

/**
 * Wire real catalog_item ids + the merchant into an already-assembled template so
 * the storefront becomes purchasable. `idByHandle` maps each imported product's
 * handle (the placeholder id stamped by applyProductBlocks) to its real catalog_item
 * id — failure-tolerant, so a product that failed to provision is simply dropped from
 * the grid rather than mislabeling its neighbors. Sets:
 *   • products_grid.content.productIds  → the grid fetches live catalog data
 *   • products_grid.content.products[i].id → keeps the preview snapshot addressable
 *   • data.meta.ecom.merchant_id  → what the cart/add-to-cart reads to pin the store
 * Mutates + returns `data` (the template's data blob). No-op if no grid/ids.
 */
export function wireCatalogIntoTemplate(
  data: any,
  merchantId: string,
  idByHandle: Record<string, string>
): any {
  if (!data || !merchantId) return data;
  const blocks: any[] = data?.pages?.[0]?.blocks ?? [];
  const grid = blocks.find((b) => b?.type === 'products_grid');
  if (grid?.content) {
    const inline = Array.isArray(grid.content.products) ? grid.content.products : [];
    const ids: string[] = [];
    for (const p of inline) {
      const realId = idByHandle[p?.id];
      if (realId) {
        p.id = realId;
        ids.push(realId);
      }
    }
    // Keep only products we actually provisioned (drop unmapped preview snapshots).
    grid.content.products = inline.filter((p: any) => ids.includes(p?.id));
    grid.content.productIds = ids;
  }
  data.meta = {
    ...(data.meta ?? {}),
    ecom: { ...(data.meta?.ecom ?? {}), merchant_id: merchantId },
  };
  return data;
}
