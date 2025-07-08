'use client';

import { useState } from 'react';
import type { Page, Template } from '@/types/template';
import { SortableBlockList } from './sortable-block-list';
import BlockSidebar from './block-sidebar';

export function PageBlocksList({
  page,
  template,
  onChange,
  onLivePreviewUpdate,
}: {
  page: Page;
  template: Template;
  onChange: (updated: Template) => void;
  onLivePreviewUpdate: (data: Template['data']) => void;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const ensureIds = (blocks: any[]) =>
    blocks.map((b) => ({ ...b, _id: b._id || crypto.randomUUID() }));

  const handleBlocksChange = (newBlocks: any[]) => {
    const updatedPages = template.data.pages.map((p) =>
      p.id === page.id ? { ...p, content_blocks: ensureIds(newBlocks) } : p
    );
    const updatedTemplate = {
      ...template,
      data: { ...template.data, pages: updatedPages },
    };
    onChange(updatedTemplate);
    onLivePreviewUpdate(updatedTemplate.data);
  };

  const handleInsertBlockAt = (index: number) => {
    const fallback = {
      type: 'text',
      value: { value: 'New block...' },
      _id: crypto.randomUUID(),
    };

    const blocks = ensureIds(page.content_blocks);
    const newBlocks = [...blocks.slice(0, index), fallback, ...blocks.slice(index)];
    handleBlocksChange(newBlocks);
    setSelectedIndex(index);
  };

  const handleEditBlock = (_block: any, index: number) => {
    setSelectedIndex(index);
  };

  const handleSidebarChange = (updatedBlock: any) => {
    const blocks = ensureIds(page.content_blocks);
    const updated = [...blocks];
    updated[selectedIndex!] = updatedBlock;
    handleBlocksChange(updated);
  };

  return (
    <div className="mt-2">
      <SortableBlockList
        blocks={ensureIds(page.content_blocks)}
        onChange={handleBlocksChange}
        onBlockEdit={handleEditBlock}
        onInsertBlock={handleInsertBlockAt}
      />

      {selectedIndex !== null && (
        <BlockSidebar
          block={page.content_blocks[selectedIndex]}
          onChange={handleSidebarChange}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
}
