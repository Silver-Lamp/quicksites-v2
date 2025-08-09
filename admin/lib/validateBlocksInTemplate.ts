// admin/lib/validateBlocksInTemplate.ts
import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import type { ValidatedTemplate } from '@/admin/lib/zod/templateSaveSchema';

export function validateBlocksInTemplate(template: ValidatedTemplate): string[] {
  // alert('validateBlocksInTemplate');
  const errors: string[] = [];
  template?.pages?.forEach((page: any, pageIndex: number) => {
    page?.content_blocks?.forEach((block: any, blockIndex: number) => {
      const result = BlockSchema.safeParse(block);
      if (!result.success) {
        const blockType = (block as any)?.type || '(unknown)';
        const pageLabel = page?.title || `Page ${pageIndex + 1}`;
        const blockLabel = `Block ${blockIndex + 1}`;
        errors.push(
          `❌ ${pageLabel} → ${blockLabel}: Invalid block type "${blockType}".\n` +
          `↪ Expected one of: text, image, video, audio, quote, button, grid, testimonial, services, cta`
        );
      }
    });
  });

  return errors;
}
