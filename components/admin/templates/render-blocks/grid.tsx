'use client';

import type { GridBlock as GridBlockType, Block } from '@/types/blocks';
import { useState } from 'react';
import { normalizeBlock } from '@/types/blocks';
import SortableGridBlock from '../sortable-grid-block';
import RenderBlock from '../render-block';
import BlockSidebar from '../block-sidebar';
import PresetSelectorModal from '../block-presets/PresetSelectorModal';
import type { BlockWithId } from '@/types/blocks';

function updateGridBlock(block: Block, items: BlockWithId[]): Block {
  const grid = block as GridBlockType;
  return {
    ...grid,
    content: {
      ...grid.content,
      items,
    },
  };
}

type Props = {
  block?: GridBlockType;
  content?: GridBlockType['content'];
  handleNestedBlockUpdate?: (updated: Block) => void;
  parentBlock?: Block;
  compact?: boolean;
};

export default function GridRender({
  block,
  content,
  handleNestedBlockUpdate,
  parentBlock,
  compact = false,
}: Props) {
  const final = content || block?.content;
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [showPresetModal, setShowPresetModal] = useState(false);

  const normalizedItems = final?.items?.map(normalizeBlock) || [];
  const columns = final?.columns || 1;

  const gridLabel = handleNestedBlockUpdate
    ? 'Grid (drag enabled)'
    : 'Grid (static)';

  const handleSaveBlock = (updatedBlock: Block) => {
    if (editingBlockIndex === null || !parentBlock) return;
    const items = [...normalizedItems];
    items[editingBlockIndex] = normalizeBlock(updatedBlock);
    handleNestedBlockUpdate?.(updateGridBlock(parentBlock, items));
  };

  const handleInsertBlock = (block: BlockWithId) => {
    if (!parentBlock) return;
    const items = [...normalizedItems, block];
    handleNestedBlockUpdate?.(updateGridBlock(parentBlock, items));
  };

  if (compact) {
    return (
      <div className="grid gap-2 grid-cols-2 text-sm border rounded p-2">
        {normalizedItems.slice(0, 2).map((b, i) => (
          <RenderBlock key={i} block={b} compact />
        ))}
        {normalizedItems.length === 0 && (
          <div className="text-gray-400 italic col-span-2">No blocks in grid</div>
        )}
      </div>
    );
  }

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
            onChange={(updated) =>
              handleNestedBlockUpdate?.(
                updateGridBlock(parentBlock!, updated as BlockWithId[])
              )
            }
            onInsert={(index) => setEditingBlockIndex(index)}
            onDelete={(index) => {
              const items = [...normalizedItems];
              items.splice(index, 1);
              handleNestedBlockUpdate?.(updateGridBlock(parentBlock!, items));
            }}
            onEdit={(index) => setEditingBlockIndex(index)}
          />

          <div className="mt-6">
            <button
              onClick={() => setShowPresetModal(true)}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded shadow hover:bg-blue-700"
            >
              ➕ Add Block from Presets
            </button>
          </div>

          <PresetSelectorModal onSelect={handleInsertBlock} onHover={() => {}} />

          <BlockSidebar
            onOpen={editingBlockIndex !== null}
            block={editingBlockIndex !== null ? normalizedItems[editingBlockIndex] : null}
            onClose={() => setEditingBlockIndex(null)}
            onSave={handleSaveBlock}
            onReplaceWithAI={() => {}}
            onClone={() => {}}
            onShowPrompt={() => {}}
            onUndo={() => {}}
            onViewDiff={() => {}}
            undoAvailable={false}
          />
        </>
      ) : (
        <div className={`grid grid-cols-${columns} gap-4`}>
          {normalizedItems.map((b: Block, i: number) => (
            <div key={b._id || i}>
              <RenderBlock block={b} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
