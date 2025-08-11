// lib/utils/normalizePageBlocks.ts
import type { Page } from '@/types/template';
import type { Block } from '@/types/blocks';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import { ensureBlockId } from '@/admin/lib/ensureBlockId';

export function normalizePageBlocks(page: Page): Page {
  const rawBlocks = Array.isArray(page?.content_blocks) ? page.content_blocks : [];
  const normalized: Block[] = [];
  const seenIds = new Set<string>();

  for (const raw of rawBlocks) {
    try {
      // 1) ensure an _id (handles weird {_id: {...}} cases too)
      const withId: any = ensureBlockId(raw);

      // 2) make sure ids are unique per page
      if (typeof withId._id === 'string' && seenIds.has(withId._id)) {
        withId._id = crypto.randomUUID();
      }

      // 3) normalize + validate against BlockSchema (also migrates legacy shapes)
      const valid = normalizeBlock(withId) as unknown as Block;

      seenIds.add(valid._id as string);
      normalized.push(valid);
    } catch (err) {
      console.warn(
        '⚠️ normalizePageBlocks: dropped invalid block',
        { type: (raw as any)?.type, _id: (raw as any)?._id, err }
      );
      // optional: push a text fallback instead of dropping
      normalized.push({
        type: 'text',
        _id: crypto.randomUUID(),
        content: { value: `Invalid block removed: ${JSON.stringify(raw)}` },
      } as any);
    }
  }

  return { ...page, content_blocks: normalized };
}
