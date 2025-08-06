import type { Page } from '@/types/template';
import { z } from 'zod';
import { BlockSchema } from '@/admin/lib/zod/blockSchemas';
import { Block } from '@/types/blocks';
import { ensureBlockId } from '@/admin/lib/ensureBlockId';

export function normalizePageBlocks(page: Page): Page {
  const validBlocks = page.content_blocks
    .map((b) => ensureBlockId(b) as z.infer<typeof BlockSchema>)
    .filter((b): b is z.infer<typeof BlockSchema> => !!b);

  return {
    ...page,
    content_blocks: validBlocks as Block[],
  };
}
