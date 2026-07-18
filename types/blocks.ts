// types/blocks.ts
//
// Canonical, Zod-first block types + small seeding/editor API surface.
// This preserves all existing exports and adds SeedContext/BlockDefinition/etc.

import type React from 'react';
import { z } from 'zod';
import { BlockSchema, blockContentSchemaMap, blockMeta } from '@/admin/lib/zod/blockSchema';

// ---------- Existing exports (preserved) ----------

export type Block = z.infer<typeof BlockSchema>;
export type BlockType = keyof typeof blockContentSchemaMap;
export type BlockWithId = Block & { _id: string };

export type BlockCategory = 'layout' | 'content' | 'interactive' | 'meta';

export const BLOCK_CATEGORY: Record<BlockType, BlockCategory> = {
  exterior_agency: 'content',
  exterior_cleaning_agency: 'content',
  pnw_prestige: 'content',
  text: 'content',
  image: 'content',
  video: 'content',
  audio: 'content',
  quote: 'content',
  button: 'interactive',
  grid: 'layout',
  section: 'layout',
  hero: 'layout',
  services: 'content',
  faq: 'interactive',
  testimonial: 'interactive',
  footer: 'meta',
  service_areas: 'meta',
  header: 'meta',
  contact_form: 'interactive',
  cta: 'interactive',
  hours: 'meta',
  menu: 'content',
  location: 'meta',
  order_bar: 'interactive',
  restaurants_directory: 'content', // apex portal: live competition-cohort directory
  scheduler: 'interactive',
  candidate_donate: 'interactive',
  candidate_volunteer: 'interactive',
  candidate_print_qr: 'interactive',
  public_qr_info: 'interactive',
  public_qr_sidebar: 'interactive',
  // ----- NEW: commerce blocks -----
  products_grid: 'content', // grid of purchasable items/services
  service_offer: 'interactive', // single service/product CTA (planned)
  story: 'content', // alternating image+text brand storytelling
  about_that: 'content', // HiveJournal narrated-audio embed (loader script only)
  audio_faq: 'interactive', // HiveJournal /ask — grounded owner-voice Q&A on the page
  quote_of_the_day: 'content', // HiveJournal cached daily quote (zero-consent)
  daily_artifact: 'content', // HiveJournal daily comic (consent-gated, opt-in token)
  listing_card: 'content', // real-estate listing w/ built-in About That agent slot
  listings_grid: 'content', // agent portfolio: many homes, per-home audio tours
  vehicles_grid: 'content', // auto-dealer inventory: many cars, per-car audio walkarounds
  announcement_bar: 'interactive', // dismissible site-wide promo/notice bar
  sticky_cart: 'interactive', // product-page sticky add-to-cart (order_bar sibling)
  reviews: 'content', // owner-curated reviews (+ product JSON-LD when tied to one)
  home_valuation: 'interactive', // real-estate seller-lead magnet: "what's your home worth?"
  listing_alert: 'interactive', // real-estate buyer-lead: "get new listings first"
  affordability_calculator: 'interactive', // buyer tool: "how much home can I afford?" (28/36)
  job_listing: 'interactive', // odd-jobs board gig: post + apply + submit (AisleAsk wedge)
  deck_estimate: 'interactive', // DeckSketch ballpark widget: dims in → price range + builder lead
  comments: 'interactive', // public UGC: moderated visitor comments/discussion
  demo_embed: 'content', // HJ studio demo by slug (MP4 or live caption-player)
  voice_welcome: 'content', // HJ render-once TTS "hello" player (narrator default → owner clone)
  testimonial_audio: 'content', // HJ narrator-read reviews — written quote + "hear this review" ▶
  route_optimizer: 'interactive', // PorchHearth nearest-neighbor stop ordering ($0, straight-line)
  events: 'content', // upcoming + recurring schedule (service times, classes, gatherings)
  gallery: 'content', // responsive photo grid + lightbox (every visual business)
  before_after: 'interactive', // draggable before/after reveal (transformation trades)

  /* ───────── ElectInfo (candidate) blocks ───────── */
  candidate_hero: 'layout',
  candidate_about: 'content',
  candidate_issues_grid: 'content',
  candidate_endorsements: 'content',
  candidate_events: 'content',
  candidate_stay_connected: 'interactive',
} as const;

export type BlockMetadata = {
  type: BlockType;
  label: string;
  icon: string;
  category: BlockCategory;
  isStatic?: boolean;
};

export const BLOCK_METADATA: BlockMetadata[] = (
  Object.keys(blockContentSchemaMap) as BlockType[]
).map((type) => ({
  type,
  label: blockMeta[type]?.label ?? type,
  icon: blockMeta[type]?.icon ?? '📦',
  category: BLOCK_CATEGORY[type] ?? 'content',
  isStatic: type === 'header' || type === 'footer',
}));

export function isBlockType(val: string): val is BlockType {
  return Object.prototype.hasOwnProperty.call(blockContentSchemaMap, val);
}

// Re-export to keep old imports working
export { normalizeBlock } from '@/lib/utils/normalizeBlock';

// ---------- New: seeding/editor API types ----------

/**
 * Context the seeder/factory can use to build realistic default content
 * from the merchant/industry data produced by your seeding pipeline.
 */
export type SeedContext = {
  industry?: string;
  merchant?: {
    name: string;
    tagline?: string;
    about?: string;
    logo_url?: string;
    phone?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    hours?: Record<string, { open: string; close: string }>;
    social?: Record<string, string>;
    images?: { hero?: string; banner?: string; team?: string };
  };
  services?: Array<{
    name: string;
    description?: string;
    price?: string | number;
    icon?: string;
    href?: string;
  }>;
  products?: Array<{
    name: string;
    description?: string;
    price?: number | string;
    image?: string;
    href?: string;
  }>;
  assets?: { hero?: string; palette?: { accent?: string } };
  locale?: { city?: string; region?: string; state?: string; country?: string; currency?: string };

  /** helpers */
  id: () => string; // e.g., crypto.randomUUID()
  random: () => number; // for sampling
};

/** Props delivered to a block renderer (kept generic so you can reuse renderers easily) */
export type RendererProps<TProps = any> = {
  block: Block & { props: TProps };
  previewOnly?: boolean;
};

/**
 * Optional per-block API surface (schema normally comes from your Zod map).
 * You can register a factory for seeding and a migration for version bumps.
 */
export interface BlockDefinition<TProps = any> {
  /** Canonical type (key in blockContentSchemaMap) OR a legacy/alias string */
  type: string;
  /** Extra names you want to accept (e.g., 'services_grid') */
  aliases?: string[];
  /** Prefer the canonical schema from your Zod map; this is only for one-offs. */
  schema?: z.ZodType<TProps>;
  version?: number;
  factory?: {
    /** Produce a block with sensible defaults */
    default?: (ctx: SeedContext) => Block;
    /** Produce a block from real merchant/services data */
    seed?: (ctx: SeedContext) => Block | Block[];
  };
  /** Transform older shapes into the current one */
  migrate?: (legacy: Block) => Block;
}

/** Utility: access the canonical Zod schema when you only have a string key */
export function schemaFor(type: BlockType): z.ZodType<any> {
  const s = blockContentSchemaMap[type];
  return typeof s === 'function' ? (s as any)() : (s as unknown as z.ZodType<any>);
}
