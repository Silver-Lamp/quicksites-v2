// components/admin/templates/page-blocks-list.tsx
'use client';

import { useState } from 'react';
import type { Page, Template } from '@/types/template';
import { SortableBlockList } from './sortable-block-list';
import BlockSidebar from './block-sidebar';

type Props = {
  page: Page;
  template: Template;
  onChange: (updated: Template) => void;
  onLivePreviewUpdate: (data: Template['data']) => void;
};

export function PageBlocksList({
  page,
  template,
  onChange,
  onLivePreviewUpdate,
}: Props) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Ensure every block has an _id
  const ensureIds = <T extends { _id?: string }>(blocks: T[]) =>
    blocks.map((b) => ({ ...b, _id: b._id || crypto.randomUUID() }));

  // Always work with a defined array for the current page’s blocks
  const pageBlocks = ensureIds(page.content_blocks ?? []);

  const handleBlocksChange = (newBlocks: any[]) => {
    // Work with a defined pages array
    const currentPages = Array.isArray(template.data?.pages)
      ? template.data.pages
      : [];

    const updatedPages = currentPages.map((p) =>
      p.id === page.id ? { ...p, content_blocks: ensureIds(newBlocks) } : p
    );

    const nextData = {
      ...(template.data ?? {}),
      pages: updatedPages,
    } as Template['data'];

    const updatedTemplate: Template = {
      ...template,
      data: nextData,
    };

    onChange(updatedTemplate);
    onLivePreviewUpdate(nextData);
  };

  const handleInsertBlockAt = (index: number) => {
    const fallback = {
      type: 'text',
      content: { value: 'New block...' },
      _id: crypto.randomUUID(),
    };

    const newBlocks = [
      ...pageBlocks.slice(0, index),
      fallback,
      ...pageBlocks.slice(index),
    ];

    handleBlocksChange(newBlocks);
    setSelectedIndex(index);
  };

  const handleEditBlock = (_block: any, index: number) => {
    setSelectedIndex(index);
  };

  const handleSidebarChange = (updatedBlock: any) => {
    if (selectedIndex == null) return;
    const updated = [...pageBlocks];
    updated[selectedIndex] = updatedBlock;
    handleBlocksChange(updated);
  };

  return (
    <div className="mt-2">
      <SortableBlockList
        blocks={pageBlocks}
        onChange={handleBlocksChange}
        onBlockEdit={handleEditBlock}
        onInsertBlock={handleInsertBlockAt}
      />

      {selectedIndex !== null && pageBlocks[selectedIndex] && (
        <BlockSidebar
          block={pageBlocks[selectedIndex]}
          onSave={handleSidebarChange}
          onClose={() => setSelectedIndex(null)}
          onOpen
          onReplaceWithAI={() => {}}
          onClone={() => {}}
          onShowPrompt={() => {}}
          onUndo={() => {}}
          onViewDiff={() => {}}
          undoAvailable={false}
        />
      )}
    </div>
  );
}

export default PageBlocksList;
