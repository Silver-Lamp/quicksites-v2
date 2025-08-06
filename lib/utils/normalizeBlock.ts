import { z } from 'zod';
import { BlockSchema } from '@/admin/lib/zod/blockSchemas';
import type { Block } from '@/types/blocks';

// Optional: strict shape validator (minimal)
function isLikelyValidBlockShape(block: any): block is { type: string; content: object } {
  return (
    block &&
    typeof block === 'object' &&
    typeof block.type === 'string' &&
    typeof block.content === 'object' &&
    block.content !== null
  );
}

export function normalizeBlock(block: Partial<Block>): z.infer<typeof BlockSchema> {
  let id = block._id;

  // Defensive fix for malformed _id
  if (typeof id !== 'string') {
    if (typeof id === 'object' && id !== null) {
      const idObj = id as Record<string, any>;
      if (typeof idObj._id === 'string') {
        id = idObj._id;
      } else if (Object.values(idObj).every((c) => typeof c === 'string')) {
        id = Object.values(idObj).join('');
      } else {
        id = crypto.randomUUID();
      }
    } else {
      id = crypto.randomUUID();
    }
  }

  const preValidated = { ...block, _id: id };

  // 🔍 Check for clearly broken block structure
  if (!isLikelyValidBlockShape(preValidated)) {
    console.warn(`⚠️ Skipping malformed block`, JSON.stringify(preValidated, null, 2));
    throw new Error(`Invalid block shape for type: ${block?.type}`);
  }

  if (block?.type === 'header') {
    console.warn('🪵 HEADER BLOCK DEBUG', JSON.stringify(block, null, 2));
  }

  if (block?.type === 'service_areas') {
    console.warn('🪵 SERVICE AREAS BLOCK DEBUG', JSON.stringify(block, null, 2));
  }

  const result = BlockSchema.safeParse(preValidated);

  if (!result.success) {
    console.warn(`❌ normalizeBlock: Invalid block "${block?.type}"`, result.error.format());
    throw new Error(`Invalid block: ${block?.type}`);
  }

  return result.data;
}
