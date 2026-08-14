// lib/theme/blockMass.ts
//
// How much CONTENT a block actually holds, so the page can stop spending the same amount of
// vertical space on a block with forty rows and a block with four words.
//
// ⚠️ THIS IS THE BIGGEST SINGLE CAUSE OF THE "STACK OF BOXES" LOOK, AND IT IS NOT A COLOUR
// PROBLEM. `SectionShell` applies `py-16` unconditionally, so on a listing-imported auto-shop
// draft this rendered:
//
//     [ ~350px band ]  Our Services
//                      Car Repair
//
// A business whose Google listing yields exactly one category gets one service, and one service
// got the same full-height band as a restaurant menu. The band is what reads as a box: it is
// mostly empty, so the eye sees the container instead of the content. Same for a `cta` block,
// which is a single link and was given a band of its own.
//
// The heuristic is deliberately blunt — one signal, "is this a single short unit?" — because a
// finer-grained scale would need to know how each block renders, and that knowledge belongs in
// the block, not here. Anything it can't classify is `normal`, which is exactly today's
// behaviour, so a new block type is never made worse by not being listed.
//
// It mirrors each renderer's own content resolution rather than guessing at a field name. Where
// it can't (a block that fetches its own data), it says `normal` — the cost of being wrong in
// that direction is a slightly roomy section, and the cost of being wrong the other way is a
// cramped one on real content.

import type { Block } from '@/types/blocks';

export type BlockMass = 'thin' | 'normal';

/**
 * Blocks that own their own vertical rhythm or are inherently large (media, forms, chrome).
 * Never thinned, regardless of how few fields they carry.
 */
const NEVER_THIN = new Set([
  'header',
  'footer',
  'hero',
  'contact_form',
  'menu',
  'menu_finder',
  'order_bar',
  'map',
  'gallery',
  'image',
  'video',
  'about_that',
  'scheduler',
  'agent_roster',
  'listing_search',
  'listing_card',
  'home_valuation',
  'listing_alert',
  'affordability_calculator',
  'mortgage_calculator',
  'bill_estimator',
  'products_grid',
  'service_offer',
]);

function count(v: unknown): number {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
}

function words(v: unknown): number {
  return typeof v === 'string' ? v.trim().split(/\s+/).filter(Boolean).length : 0;
}

/**
 * How many distinct pieces of content the block will render. `null` = "can't tell", which the
 * caller treats as `normal`.
 */
function contentUnits(block: any, template: any): number | null {
  const type = String(block?.type || '');
  const content = block?.content ?? {};

  switch (type) {
    // A CTA is one link by construction. It never earns a full band.
    case 'cta':
      return 1;

    // Mirrors services.tsx: site-level services win over the block's own list.
    case 'services': {
      const fromData = count(template?.data?.services);
      if (fromData) return fromData;
      return count(content.items) || count(content.services) || 0;
    }

    case 'faq':
      return count(content.items) || count(block?.props?.items) || 0;

    case 'testimonial':
    case 'quote':
      return count(content.items) || count(content.testimonials) || 1;

    case 'text':
    case 'rich_text':
    case 'about':
      // Prose is measured in words, not items: a single 200-word paragraph is not thin.
      return words(content.value ?? content.text ?? content.body ?? content.html) > 40 ? 2 : 1;

    default:
      return null;
  }
}

/**
 * `thin` when the block renders a single short unit — one service, one link, one line of prose.
 * Everything else, including anything unrecognised, is `normal`.
 */
export function blockMass(block: Block | any, template?: any): BlockMass {
  const type = String(block?.type || '');
  if (!type || NEVER_THIN.has(type)) return 'normal';

  const units = contentUnits(block, template);
  if (units === null) return 'normal';
  return units <= 1 ? 'thin' : 'normal';
}
