// components/admin/templates/render-blocks/grid.tsx
'use client';

import * as React from 'react';
import type { Block, BlockWithId } from '@/types/blocks';
import type { Template } from '@/types/template';

import { normalizeBlock } from '@/lib/utils/normalizeBlock';
import SortableGridBlock from '../sortable-grid-block';
import RenderBlock from '../render-block';
import BlockSidebar from '../block-sidebar';
import PresetSelectorModal from '../block-presets/PresetSelectorModal';

function updateGridBlock(block: Block, items: BlockWithId[]): Block {
  const grid = block as Block;
  return {
    ...grid,
    content: {
      ...grid.content,
      items: items as any,
    },
  };
}

type Props = {
  block?: Block;
  content?: Block['content'];
  handleNestedBlockUpdate?: (updated: Block) => void;
  parentBlock?: Block;
  compact?: boolean;
  /** Desired column count in view mode (clamped to 1..4) */
  columns?: number;
  gridLabel?: string;
  gridLabelStatic?: string;
  template: Template;
  /** Forward site/block color mode to children (overrides template inference) */
  colorMode?: 'light' | 'dark';
};

export default function GridRender({
  block,
  content: contentProp,
  handleNestedBlockUpdate,
  parentBlock,
  compact = false,
  columns = 1,
  gridLabel = 'Grid',
  gridLabelStatic = 'Grid',
  template,
  colorMode,
}: Props) {
  const final = (contentProp as any) || block?.content || { items: [] };

  // Normalize once per render (items can be heterogeneous block types)
  const normalizedItems = React.useMemo(
    () => (final?.items?.map(normalizeBlock) as BlockWithId[]) || [],
    // stringify is resilient to shallow changes, but if you already memoize upstream, you can swap this to [final?.items]
    [JSON.stringify(final?.items ?? [])]
  );

  const [editingBlockIndex, setEditingBlockIndex] = React.useState<number | null>(null);
  const [showPresetModal, setShowPresetModal] = React.useState(false);

  const clampedCols = React.useMemo(() => {
    const n = Number.isFinite(columns as any) ? Number(columns) : 1;
    return Math.min(4, Math.max(1, n));
  }, [columns]);

  // Tailwind JIT-safe mapping for grid columns (so classes are statically discoverable)
  const colsClass = React.useMemo(() => {
    switch (clampedCols) {
      case 1:
        return 'grid-cols-1';
      case 2:
        return 'grid-cols-1 sm:grid-cols-2';
      case 3:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
      default:
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    }
  }, [clampedCols]);

  const handleSaveBlock = (updatedBlock: Block) => {
    if (editingBlockIndex === null || !parentBlock) return;
    const items = [...normalizedItems];
    items[editingBlockIndex] = normalizeBlock(updatedBlock) as BlockWithId;
    handleNestedBlockUpdate?.(updateGridBlock(parentBlock, items));
  };

  const handleInsertBlock = (newBlock: BlockWithId) => {
    if (!parentBlock) return;
    const items = [...normalizedItems, newBlock];
    handleNestedBlockUpdate?.(updateGridBlock(parentBlock, items));
    setShowPresetModal(false);
    setEditingBlockIndex(items.length - 1);
  };

  if (compact) {
    return (
      <div className="grid grid-cols-2 gap-2 text-sm border border-border rounded p-2">
        {normalizedItems.slice(0, 2).map((b, i) => (
          <RenderBlock
            key={b._id || b.id || `${i}-${(b as any).type}`}
            block={b}
            compact
            showDebug={false}
            template={template}
            colorMode={colorMode}
          />
        ))}
        {normalizedItems.length === 0 && (
          <div className="col-span-2 italic text-muted-foreground">No blocks in grid</div>
        )}
      </div>
    );
  }

  return (
    <div className="relative mb-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs italic text-muted-foreground" aria-label="Grid label">
          {gridLabel || gridLabelStatic}
        </span>
        <span className="text-xs text-muted-foreground">
          {normalizedItems.length} item{normalizedItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {handleNestedBlockUpdate ? (
        <>
          <SortableGridBlock
            columns={clampedCols}
            items={normalizedItems}
            onChange={(updated) =>
              handleNestedBlockUpdate?.(updateGridBlock(parentBlock!, updated as BlockWithId[]))
            }
            onInsert={(index) => {
              // Open presets to choose a block to insert; remember target index
              setEditingBlockIndex(index);
              setShowPresetModal(true);
            }}
            onDelete={(index) => {
              const items = [...normalizedItems];
              items.splice(index, 1);
              handleNestedBlockUpdate?.(updateGridBlock(parentBlock!, items));
              if (editingBlockIndex != null && index === editingBlockIndex) {
                setEditingBlockIndex(null);
              }
            }}
            onEdit={(index) => setEditingBlockIndex(index)}
            template={template}
          />

          <div className="mt-6">
            <button
              onClick={() => setShowPresetModal(true)}
              className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground shadow hover:opacity-90"
            >
              ➕ Add Block from Presets
            </button>
          </div>

          {/* Modal is tolerant of extra props if it doesn't support controlled mode */}
          <PresetSelectorModal
            // @ts-expect-error allow controlled props if supported
            open={showPresetModal}
            // // @ts-expect-error allow controlled props if supported
            onOpenChange={setShowPresetModal}
            onSelect={handleInsertBlock}
            onHover={() => {}}
            template={template}
          />

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
            template={template}
          />
        </>
      ) : (
        <div className={`grid ${colsClass} gap-4`}>
          {normalizedItems.map((b, i) => (
            <div key={b._id || b.id || `${i}-${(b as any).type}`}>
              <RenderBlock
                block={b}
                showDebug={false}
                template={template}
                colorMode={colorMode}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
