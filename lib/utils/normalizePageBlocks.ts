// lib/utils/normalizePageBlocks.ts
import type { Page } from '@/types/template';
import { normalizeBlock } from '@/types/blocks';

export function normalizePageBlocks(page: Page): Page {
  return {
    ...page,
    content_blocks: page.content_blocks.map((block) => normalizeBlock(block)),
  };
}