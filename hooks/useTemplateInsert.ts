// hooks/useTemplateInsert.ts
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Template } from '@/types/template';

export function useTemplateInsert(
  setTemplate: (updater: (prev: Template) => Template) => void
) {
  const [recentlyInsertedBlockId, setRecentlyInsertedBlockId] = useState<string | null>(null);
  const [lastInsertedBlock, setLastInsertedBlock] = useState<{ pageIndex: number; blockIndex: number } | null>(null);

  const insertBlock = (text: string, pageIndex = 0) => {
    const newId = uuidv4();
    setTemplate((prev) => {
      const updated = { ...prev };
      const blocks = updated.data.pages[pageIndex].content_blocks;
      const blockIndex = blocks.length;

      blocks.push({
        _id: newId,
        type: 'text',
        content: { value: text },
        tags: ['ai'],
      });

      setLastInsertedBlock({ pageIndex, blockIndex });
      return updated;
    });

    setRecentlyInsertedBlockId(newId);
  };

  const undoInsert = () => {
    if (!lastInsertedBlock) return;

    setTemplate((prev) => {
      const updated = { ...prev };
      updated.data.pages[lastInsertedBlock.pageIndex].content_blocks.splice(lastInsertedBlock.blockIndex, 1);
      return updated;
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
