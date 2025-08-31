// lib/blocks/getBlockMenu.ts
import type { BlockType } from '@/types/blocks';
import { BLOCK_METADATA } from '@/types/blocks';
import { STATIC_RENDERERS, DYNAMIC_RENDERERS } from '@/lib/renderBlockRegistry';

export type BlockMenuItem = {
  type: BlockType;
  label: string;
  icon: string;
  isStatic?: boolean;
};

export type BlockMenuByCategory = {
  layout: BlockMenuItem[];
  content: BlockMenuItem[];
  interactive: BlockMenuItem[];
  meta: BlockMenuItem[];
};

/**
 * Returns a menu grouped by category, showing only blocks that have a renderer.
 * Pass includeUnrenderable=true if you want to list everything regardless of UI support.
 */
export function getBlockMenuByCategory(includeUnrenderable = false): BlockMenuByCategory {
  const renderable = new Set<BlockType>([
    ...(Object.keys(STATIC_RENDERERS) as BlockType[]),
    ...(Object.keys(DYNAMIC_RENDERERS) as BlockType[]),
  ]);

  const out: BlockMenuByCategory = { layout: [], content: [], interactive: [], meta: [] };

  for (const m of BLOCK_METADATA) {
    if (!includeUnrenderable && !renderable.has(m.type)) continue;
    out[m.category].push({
      type: m.type,
      label: m.label,
      icon: m.icon,
      isStatic: m.isStatic,
    });
  }

  // sort each group by label for a nicer palette
  (Object.keys(out) as Array<keyof BlockMenuByCategory>).forEach((k) =>
    out[k].sort((a, b) => a.label.localeCompare(b.label))
  );

  return out;
}
