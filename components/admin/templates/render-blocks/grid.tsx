'use client';

import type { GridBlock, Block } from '@/types/blocks';
import { useState } from 'react';
import { normalizeBlock } from '@/types/blocks';
import SortableGridBlock from '../sortable-grid-block';
import RenderBlock from '../render-block';
import BlockSidebar from '../block-sidebar';
import PresetSelectorModal from '../block-presets/PresetSelectorModal';
import type { BlockWithId } from '@/types/blocks';

function updateGridBlock(block: Block, items: BlockWithId[]): Block {
  const grid = block as GridBlock;
  return {
    ...grid,
    content: {
      ...grid.content,
      items,
    },
  };
}

export default function GridBlock({
  content,
  handleNestedBlockUpdate,
  parentBlock,
}: {
  content: GridBlock['content'];
  handleNestedBlockUpdate?: (updated: Block) => void;
  parentBlock: Block;
}) {
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [showPresetModal, setShowPresetModal] = useState(false);

  const normalizedItems = content.items?.map(normalizeBlock) || [];
  const gridLabel = handleNestedBlockUpdate ? 'Grid (drag enabled)' : 'Grid (static)';
  const columns = content.columns || 1;

  const handleSaveBlock = (updatedBlock: Block) => {
    if (editingBlockIndex === null) return;
    const items = [...normalizedItems];
    items[editingBlockIndex] = normalizeBlock(updatedBlock);
    handleNestedBlockUpdate?.(updateGridBlock(parentBlock, items));
  };

  const handleInsertBlock = (block: BlockWithId) => {
    const items = [...normalizedItems, block];
    handleNestedBlockUpdate?.(updateGridBlock(parentBlock, items));
  };

  return (
    <div className="mb-4 relative">
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs italic text-gray-600 dark:text-gray-400">{gridLabel}</span>
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {normalizedItems.length} item{normalizedItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {handleNestedBlockUpdate ? (
        <>
          <SortableGridBlock
            columns={columns}
            items={normalizedItems}
            onChange={(updated) => {
              handleNestedBlockUpdate?.(updateGridBlock(parentBlock, updated as BlockWithId[]));
            }}
            onInsert={(index) => {
              setEditingBlockIndex(index);
            }}
            onDelete={(index) => {
              const items = [...normalizedItems];
              items.splice(index, 1);
              handleNestedBlockUpdate?.(updateGridBlock(parentBlock, items));
            }}
            onEdit={(index) => {
              setEditingBlockIndex(index);
            }}
          />

          <div className="mt-6">
            <button
              onClick={() => setShowPresetModal(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded shadow hover:bg-blue-700"
            >
              ➕ Add Block from Presets
            </button>
          </div>

          <PresetSelectorModal
            open={showPresetModal}
            onClose={() => setShowPresetModal(false)}
            onSelect={handleInsertBlock}
          />

          <BlockSidebar
            onOpen={editingBlockIndex !== null}
            block={editingBlockIndex !== null ? normalizedItems[editingBlockIndex] : null}
            onClose={() => setEditingBlockIndex(null)}
            onSave={handleSaveBlock}
          />
        </>
      ) : (
        <div className={`grid grid-cols-${columns} gap-4`}>
          {normalizedItems.map((b: Block, i: number) => (
            <div id={`block-${b._id}`}>
              <RenderBlock key={i} block={b} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}