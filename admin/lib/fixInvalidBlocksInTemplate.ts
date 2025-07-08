// admin/lib/fixInvalidBlocksInTemplate.ts
import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import type { Template } from '@/types/template';

export function fixInvalidBlocksInTemplate(template: Template): Template {
  const fallback = {
    type: 'text',
    value: { value: 'Placeholder content (auto-fixed)' },
  };

  const fixedPages = template.data.pages.map((page) => {
    const fixedBlocks = page.content_blocks.map((block) => {
      const valid = BlockSchema.safeParse(block).success;
      return valid ? block : { ...fallback, id: crypto.randomUUID() };
    });
    return { ...page, content_blocks: fixedBlocks };
  });

  return {
    ...template,
    data: { ...template.data, pages: fixedPages },
  };
}
