// lib/authorSites/buildAuthorStorefront.ts
//
// The pure author-storefront scaffold shared by the Arlo demo seeder
// (app/api/admin/templates/seed-author-demo) and the reseller handoff-provisioning
// flow (lib/authorSites/provisionAuthorSite). Both assemble the identical page —
// author-industry starter + a products grid wired to imported catalog items + an
// "About the author" story block — so it lives here as one testable function rather
// than duplicated inline in a route.
//
// Pure: takes already-created merchant + item ids, returns the template payload the
// caller inserts. The caller owns all DB writes + the publish RPC.
import { buildIndustryStarter } from '@/lib/builder/industryScaffold';
import { createDefaultBlock } from '@/lib/createDefaultBlock';

export type AuthorStorefrontOpts = {
  authorName: string;
  workTitle: string;
  slug: string;
  merchantId: string;
  /** Catalog item ids the products grid points at (may be empty for a pending-import shell). */
  itemIds: string[];
  /** About-the-author bio paragraph; a story block is added when this (or labelingLine) is set. */
  bio?: string;
  /** A line appended verbatim under the bio (e.g. HJ's fictional-author labeling requirement). */
  labelingLine?: string;
  /** Hero subheadline override (else a sensible book default). */
  subheadline?: string;
  /** Extra keys merged into data.meta (e.g. is_starter / fictional_author / org stamps). */
  extraMeta?: Record<string, any>;
};

export type AuthorStorefront = {
  data: any;
  colorMode: string;
  headerBlock: any;
  footerBlock: any;
};

export function buildAuthorStorefront(opts: AuthorStorefrontOpts): AuthorStorefront {
  const tpl: any = buildIndustryStarter({ businessName: opts.authorName, industryKey: 'author' });
  tpl.slug = opts.slug;

  const page0 = tpl.data?.pages?.[0];
  const blocks: any[] = Array.isArray(page0?.blocks) ? page0.blocks : [];

  const hero = blocks.find((b) => b?.type === 'hero');
  if (hero?.content) {
    hero.content.headline = `${opts.authorName} — author of ${opts.workTitle}`;
    hero.content.subheadline =
      opts.subheadline ||
      'Available in paperback and audiobook — order directly from the author.';
    if ('cta_text' in hero.content) hero.content.cta_text = 'Get the book';
    if ('cta_link' in hero.content) hero.content.cta_link = '#products';
  }

  const grid = blocks.find((b) => b?.type === 'products_grid');
  if (grid) {
    grid.content = {
      ...(grid.content ?? {}),
      title: 'The Book & Audiobook',
      section_title: 'The Book & Audiobook',
      columns: 2,
      product_ids: opts.itemIds,
      productIds: opts.itemIds,
    };
  }

  // About-the-author story block: only when there's something to say.
  if (opts.bio || opts.labelingLine) {
    const story: any = createDefaultBlock('story');
    const body = [opts.bio, opts.labelingLine].filter(Boolean).join('\n\n');
    story.content = {
      ...story.content,
      title: `About ${opts.authorName}`,
      sections: [
        {
          heading: `About ${opts.authorName}`,
          body,
          image_url: '',
          cta_text: '',
          cta_link: '',
        },
      ],
    };
    const gridIdx = blocks.findIndex((b) => b?.type === 'products_grid');
    blocks.splice(gridIdx >= 0 ? gridIdx + 1 : blocks.length, 0, story);
  }

  tpl.data.meta = {
    ...(tpl.data.meta ?? {}),
    ...(opts.extraMeta ?? {}),
    ecom: { ...(tpl.data.meta?.ecom ?? {}), ...(opts.extraMeta?.ecom ?? {}), merchant_id: opts.merchantId },
  };

  return {
    data: tpl.data,
    colorMode: tpl.color_mode ?? 'dark',
    headerBlock: tpl.header_block ?? null,
    footerBlock: tpl.footer_block ?? null,
  };
}
