import { BLOCK_REGISTRY } from '@/lib/blockRegistry';
import type { BlockType } from '@/types/blocks';
import type { BlockCategory } from '@/types/blocks';

export function getBlockMenuByCategory(): Record<BlockCategory, { type: BlockType; label: string; icon: string }[]> {
  const result: Record<BlockCategory, { type: BlockType; label: string; icon: string }[]> = {
    layout: [],
    content: [],
    interactive: [],
    meta: [],
  };

  for (const [type, entry] of Object.entries(BLOCK_REGISTRY) as [BlockType, typeof BLOCK_REGISTRY[BlockType]][]) {
    result[entry.category].push({
      type,
      label: entry.label,
      icon: entry.icon,
    });
  }

  return result;
}
