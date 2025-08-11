// types/blocks.ts
import { z } from 'zod';
import {
  BlockSchema,
  blockContentSchemaMap,
  blockMeta,
} from '@/admin/lib/zod/blockSchema';

// Inferred types from the canonical schema
export type Block = z.infer<typeof BlockSchema>;
export type BlockType = keyof typeof blockContentSchemaMap;
export type BlockWithId = Block & { _id: string };

export type BlockCategory = 'layout' | 'content' | 'interactive' | 'meta';

// Map each block type to a UI category (tweak as you like)
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
} as const;

export type BlockMetadata = {
  type: BlockType;
  label: string;
  icon: string;
  category: BlockCategory;
  isStatic?: boolean;
};

// Derived metadata for palettes/menus (label/icon come from the schema map)
export const BLOCK_METADATA: BlockMetadata[] = (
  Object.keys(blockContentSchemaMap) as BlockType[]
).map((type) => ({
  type,
  label: blockMeta[type]?.label ?? type,
  icon: blockMeta[type]?.icon ?? '📦',
  category: BLOCK_CATEGORY[type] ?? 'content',
  // mark blocks you don't want users to duplicate/move
  isStatic: type === 'header' || type === 'footer',
}));

// Tiny helper/guard
export function isBlockType(val: string): val is BlockType {
  return Object.prototype.hasOwnProperty.call(blockContentSchemaMap, val);
}

// Re-export to keep old imports working
export { normalizeBlock } from '@/lib/utils/normalizeBlock';
