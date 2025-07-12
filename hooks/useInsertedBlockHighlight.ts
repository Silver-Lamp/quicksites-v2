import { useEffect } from 'react';

export function useInsertedBlockHighlight(blockId: string, recentlyInsertedBlockId: string | null) {
  useEffect(() => {
    if (blockId === recentlyInsertedBlockId) {
      const el = document.getElementById(`block-${blockId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [blockId, recentlyInsertedBlockId]);

  return blockId === recentlyInsertedBlockId;
}
