// hooks/validateTemplateBlocks.ts
import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import type { Template } from '@/types/template';

export type BlockValidationError = {
  field: string;
  message: string;
  blockId?: string;
  blockType?: string;
};

export function validateTemplateBlocks(template: Template): {
  isValid: boolean;
  errors: Record<string, BlockValidationError[]>;
} {
  const errors: Record<string, BlockValidationError[]> = {};

  if (!template.data || !Array.isArray(template.data.pages)) {
    return { isValid: true, errors };
  }

  template.data.pages.forEach((page, pageIndex) => {
    page.content_blocks.forEach((block, blockIndex) => {
      const result = BlockSchema.safeParse(block);
      if (!result.success) {
        const key = block._id || `${page.slug}-block-${blockIndex}`;
        errors[key] = result.error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
          blockId: block._id,
          blockType: block.type,
        }));
      }
    });
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}
