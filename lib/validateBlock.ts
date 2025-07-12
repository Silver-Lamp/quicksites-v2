// lib/validateBlock.ts
import { Block } from '@/types/blocks';
import { BlockSchema } from '@/admin/lib/zod/blockSchema';

export type BlockValidationErrorMap = Record<string, string[]>;

export function validateBlock(block: Block): string[] {
  const result = BlockSchema.safeParse(block);
  if (!result.success) {
    return Object.entries(result.error.flatten().fieldErrors)
      .flatMap(([field, msgs]) => msgs?.map(msg => `${field}: ${msg}`) ?? []);
  }
  return [];
}
