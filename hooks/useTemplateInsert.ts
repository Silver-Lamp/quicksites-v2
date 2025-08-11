// hooks/useTemplateInsert.ts
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Template } from '@/types/template';

type LastInserted = { pageIndex: number; blockIndex: number } | null;

export function useTemplateInsert(
  setTemplate: (updater: (prev: Template) => Template) => void
) {
  const [recentlyInsertedBlockId, setRecentlyInsertedBlockId] = useState<string | null>(null);
  const [lastInsertedBlock, setLastInsertedBlock] = useState<LastInserted>(null);

  const insertBlock = (text: string, pageIndex = 0) => {
    const newId = uuidv4();
    let inserted: LastInserted = null;

    setTemplate((prev) => {
      // Start from safe copies
      const pages = Array.isArray(prev.data?.pages) ? [...prev.data.pages] : [];

      // Ensure target page exists (create a minimal one if needed)
      if (!pages[pageIndex]) {
        // Fill any gaps if pageIndex skips ahead
        while (pages.length < pageIndex) {
          pages.push({
            id: crypto.randomUUID(),
            title: `Page ${pages.length + 1}`,
            slug: `page-${pages.length + 1}`,
            content_blocks: [],
          } as any);
        }
        pages[pageIndex] = {
          id: crypto.randomUUID(),
          title: pages.length === 0 ? 'Home' : `Page ${pageIndex + 1}`,
          slug: pages.length === 0 ? 'home' : `page-${pageIndex + 1}`,
          content_blocks: [],
        } as any;
      }

      const page = { ...pages[pageIndex] };
      const blocks = Array.isArray(page.content_blocks) ? [...page.content_blocks] : [];
      const blockIndex = blocks.length;

      blocks.push({
        _id: newId,
        type: 'text',
        content: { value: text },
        tags: ['ai'],
      });

      pages[pageIndex] = { ...page, content_blocks: blocks };

      inserted = { pageIndex, blockIndex };

      const nextData = { ...(prev.data ?? {}), pages } as Template['data'];
      return { ...prev, data: nextData };
    });

    setRecentlyInsertedBlockId(newId);
    if (inserted) setLastInsertedBlock(inserted);
  };

  const undoInsert = () => {
    if (!lastInsertedBlock) return;

    setTemplate((prev) => {
      const pages = Array.isArray(prev.data?.pages) ? [...prev.data.pages] : [];
      const { pageIndex, blockIndex } = lastInsertedBlock;

      if (!pages[pageIndex]) return prev;

      const page = { ...pages[pageIndex] };
      const blocks = Array.isArray(page.content_blocks) ? [...page.content_blocks] : [];

      if (blockIndex >= 0 && blockIndex < blocks.length) {
        blocks.splice(blockIndex, 1);
        pages[pageIndex] = { ...page, content_blocks: blocks };
        const nextData = { ...(prev.data ?? {}), pages } as Template['data'];
        return { ...prev, data: nextData };
      }

      return prev;
    });

    setRecentlyInsertedBlockId(null);
    setLastInsertedBlock(null);
  };

  return {
    insertBlock,
    undoInsert,
    recentlyInsertedBlockId,
    hasUndo: !!lastInsertedBlock,
  };
}
