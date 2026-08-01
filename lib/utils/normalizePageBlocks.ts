// lib/utils/normalizePageBlocks.ts
import type { Page } from '@/types/template';
import type { Block } from '@/types/blocks';
import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import { ensureBlockId } from '@/admin/lib/ensureBlockId';

/**
 * ⚠️ AN INVALID BLOCK IS DROPPED, NEVER TURNED INTO VISIBLE CONTENT.
 *
 * This used to replace a failed block with a text block whose value was
 * `Invalid block removed: ${JSON.stringify(raw)}` — and that string is CONTENT. It gets saved
 * with the template and published, so it stops being an editor diagnostic and becomes a
 * paragraph of internal JSON on a stranger's live website. A real one shipped: a person's entire
 * biography, their email and their home city, rendered as raw JSON on their own published page,
 * because one section had an empty heading.
 *
 * Two things were wrong with it. It leaked the owner's data to visitors in a format that reads as
 * a crash, and it PERSISTED — a corrupted block that survives a save is not a warning, it's
 * damage. (The original author's own comment called the fallback "optional", so dropping was
 * always the intent.)
 *
 * Now: drop it, warn on the console, and tell the caller via `onDrop` so the editor can surface
 * the loss to the owner without putting anything on the page. Same rule as a missing backdrop —
 * where we have nothing valid to render, render nothing at all.
 */
export function normalizePageBlocks(
  page: Page,
  onDrop?: (info: { type?: string; _id?: string; error: unknown }) => void,
): Page {
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
      onDrop?.({ type: (raw as any)?.type, _id: (raw as any)?._id, error: err });
      // Deliberately NOT replaced with a text block — see the note above.
    }
  }

  return { ...page, content_blocks: normalized };
}
