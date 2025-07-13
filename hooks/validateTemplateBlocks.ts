import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import type { Template } from '@/types/template';

export function validateTemplateBlocks(template: Template): {
  isValid: boolean;
  errors: Record<string, string[]>;
} {
  const errors: Record<string, string[]> = {};

  const blocks = template.data.pages.flatMap((page) => page.content_blocks);

  blocks.forEach((block) => {
    const result = BlockSchema.safeParse(block);
    if (!result.success) {
      errors[block._id ?? 'unknown'] = result.error.errors.map((e) => {
        return e.path.join('.') + ' ' + e.message;
      });
    }
  });

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}