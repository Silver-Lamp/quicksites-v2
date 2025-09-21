// types/blocks.ts
//
// Canonical, Zod-first block types + small seeding/editor API surface.
// This preserves all existing exports and adds SeedContext/BlockDefinition/etc.

import type React from 'react';
import { z } from 'zod';
import {
  BlockSchema,
  blockContentSchemaMap,
  blockMeta,
} from '@/admin/lib/zod/blockSchema';

// ---------- Existing exports (preserved) ----------

export type Block = z.infer<typeof BlockSchema>;
export type BlockType = keyof typeof blockContentSchemaMap;
export type BlockWithId = Block & { _id: string };

export type BlockCategory = 'layout' | 'content' | 'interactive' | 'meta';

export const BLOCK_CATEGORY: Record<BlockType, BlockCategory> = {
  text: 'content',
  image: 'content',
  video: 'content',
  audio: 'content',
  quote: 'content',
  button: 'interactive',
  grid: 'layout',
  hero: 'layout',
  services: 'content',
  faq: 'interactive',
  testimonial: 'interactive',
  footer: 'meta',
  service_areas: 'meta',
  header: 'meta',
  contact_form: 'interactive',
  meal_card: 'content',
  chef_profile: 'content',
  cta: 'interactive',
  meals_grid: 'content',
  reviews_list: 'content',
  hours: 'meta',
  scheduler: 'interactive',

  // ----- NEW: commerce blocks -----
  products_grid: 'content',     // grid of purchasable items/services
  service_offer: 'interactive', // single service/product CTA (planned)
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
  services?: Array<{ name: string; description?: string; price?: string | number; icon?: string; href?: string }>;
  products?: Array<{ name: string; description?: string; price?: number | string; image?: string; href?: string }>;
  assets?: { hero?: string; palette?: { accent?: string } };
  locale?: { city?: string; region?: string; state?: string; country?: string; currency?: string };

  /** helpers */
  id: () => string;      // e.g., crypto.randomUUID()
  random: () => number;  // for sampling
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
