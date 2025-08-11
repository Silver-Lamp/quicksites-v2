// admin/lib/fixInvalidBlocksInTemplate.ts
import type { Template, Page } from '@/types/template';
import type { Block } from '@/types/blocks';
import { ensureBlockId } from '@/admin/lib/ensureBlockId';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';

export function fixInvalidBlocksInTemplate(template: Template): Template {
  // pages can be missing; default to []
  const pages: Page[] = Array.isArray(template?.data?.pages)
    ? (template.data!.pages as Page[])
    : [];

  const makePlaceholder = (): Block =>
    ({
      type: 'text',
      _id: crypto.randomUUID(),
      content: { value: 'Placeholder content (auto-fixed)' },
    } as unknown as Block);

  const fixedPages: Page[] = pages.map((page) => {
    const srcBlocks = Array.isArray(page.content_blocks) ? page.content_blocks : [];
    const seenIds = new Set<string>();

    const fixedBlocks: Block[] = srcBlocks.map((blk) => {
      try {
        // 1) ensure an _id (handles weird {_id:{...}} too)
        const withId: any = ensureBlockId(blk);

        // 2) de-dupe ids within page
        if (typeof withId._id === 'string' && seenIds.has(withId._id)) {
          withId._id = crypto.randomUUID();
        }

        // 3) normalize + validate (handles legacy shapes + grid recursion)
        const normalized = normalizeBlock(withId) as unknown as Block;

        seenIds.add(normalized._id as string);
        return normalized;
      } catch (err) {
        console.warn(
          'fixInvalidBlocksInTemplate: replaced invalid block with placeholder',
          { type: (blk as any)?.type, _id: (blk as any)?._id, err }
        );
        const ph = makePlaceholder();
        seenIds.add(ph._id as string);
        return ph;
      }
    });

    return { ...page, content_blocks: fixedBlocks };
  });

  return {
    ...template,
    data: {
      ...(template.data ?? {}),
      pages: fixedPages,
    },
  };
}
