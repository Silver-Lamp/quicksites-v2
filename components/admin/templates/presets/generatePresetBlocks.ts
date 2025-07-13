import { createFallbackBlock } from '../create-fallback-block';
import type { BlockWithId } from '@/types/blocks';

export function generatePresetBlocks(types: BlockWithId['type'][]): BlockWithId[] {
  return types.map((type) => createFallbackBlock(type));
}
