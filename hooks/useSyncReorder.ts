// hooks/useSyncReorder.ts
'use client';
import { useEffect } from 'react';
import type { Block } from '@/types/blocks';

export function useSyncReorder({
  blocks,
  setRawJson,
  template,
}: {
  blocks: Block[];
  setRawJson: (json: string) => void;
  template: any;
}) {
  useEffect(() => {
    const updated = {
      ...template,
      data: {
        ...template.data,
        pages: template.data.pages.map((page: any) => ({
          ...page,
          content_blocks: blocks,
        })),
      },
    };
    setRawJson(JSON.stringify(updated.data, null, 2));
  }, [blocks]);
}
