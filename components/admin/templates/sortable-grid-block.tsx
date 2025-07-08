'use client';

import {
  DndContext,
  closestCenter,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

import SortableBlock from './sortable-block';
import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import { motion, AnimatePresence } from 'framer-motion';
import type { Block } from '@/types/blocks';
import { normalizeBlock } from '@/types/blocks';
import { Button } from '@/components/ui/button';
import { Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { defaultGridPresets, GridPreset } from '@/types/grid-presets';
import GridTemplateModal from './grid-template-modal';

type Props = {
  items: Block[];
  onChange: (next: Block[]) => void;
  onInsert?: (index: number) => void;
  columns?: number;
  maxPerGrid?: number;
  editable?: boolean;
};

export default function SortableGridBlock({
  items,
  onChange,
  onInsert,
  columns = 2,
  maxPerGrid = 12,
  editable = true,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [draggingBlock, setDraggingBlock] = useState<Block | null>(null);
  const [isExpanded, setExpanded] = useState(true);
  const [columnCount, setColumnCount] = useState(columns);

  const handleDragStart = ({ active }: any) => {
    const found = items.find((b) => b._id === active.id);
    if (found) setDraggingBlock(found);
  };

  const handleDragEnd = (event: any) => {
    setDraggingBlock(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((b) => b._id === active.id);
    const newIndex = items.findIndex((b) => b._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    onChange(reordered);
  };

  const canInsert = editable && items.length < maxPerGrid;

  // Distribute blocks into columns
  const columnsArray: Block[][] = Array.from({ length: columnCount }, () => []);
  items.forEach((block, i) => {
    columnsArray[i % columnCount].push(block);
  });

  const handleInsertBalanced = () => {
    if (!onInsert || !canInsert) return;

    // Find the column with the fewest blocks
    const blockCounts = columnsArray.map((col) => col.length);
    const minCol = blockCounts.indexOf(Math.min(...blockCounts));
    const targetIndex = columnsArray.slice(0, minCol).flat().length;

    onInsert(targetIndex);
  };

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Grid Columns:</span>
          <select
            value={columnCount}
            onChange={(e) => setColumnCount(Number(e.target.value))}
            className="rounded bg-muted px-2 py-1 text-xs text-white"
          >
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        {editable && (
        <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Apply Template:</span>
            <select
            className="rounded bg-muted px-2 py-1 text-xs text-white"
            onChange={(e) => {
                const selected = defaultGridPresets.find((p) => p.name === e.target.value);
                if (selected) {
                onChange(selected.items.map(normalizeBlock));
                setColumnCount(selected.columns);
                }
            }}
            >
            <option value="">— Select a layout —</option>
            {defaultGridPresets.map((preset) => (
                <option key={preset.name} value={preset.name}>
                {preset.name}
                </option>
            ))}
            </select>
        </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {items.length} / {maxPerGrid} blocks
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setExpanded(!isExpanded)}
            className="text-xs"
          >
            {isExpanded ? (
              <>
                <ChevronUp className="w-3 h-3 mr-1" /> Collapse Grid
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" /> Expand Grid
              </>
            )}
          </Button>
        </div>
      </div>

      {isExpanded && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={items.map((b) => b._id).filter((id): id is string => id !== undefined)}
            strategy={verticalListSortingStrategy}
          >
            <div className={`grid grid-cols-${columnCount} gap-4`}>
              {columnsArray.map((column, colIdx) => (
                <div key={colIdx} className="flex flex-col gap-2">
                  {column.map((block, i) => {
                    const isValid = BlockSchema.safeParse(block).success;
                    return (
                      <SortableBlock key={block._id} id={block._id || ''}>
                        <motion.div
                          layout
                          className={`rounded border px-3 py-2 text-sm ${
                            isValid
                              ? 'border-gray-700 bg-white/5'
                              : 'border-red-500 bg-red-500/10'
                          }`}
                        >
                          {block?.type || '(unknown)'}
                        </motion.div>
                      </SortableBlock>
                    );
                  })}
                </div>
              ))}
            </div>

            {canInsert && onInsert && (
              <div className="text-center mt-4">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleInsertBalanced}
                  className="text-xs text-muted-foreground opacity-50 hover:opacity-100"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add to Least-Populated Column
                </Button>
                <GridTemplateModal
                    onSelect={(preset) => {
                        onChange(preset.items.map(normalizeBlock));
                        setColumnCount(preset.columns);
                    }}
                />
                <Button
                    size="icon"
                    variant="ghost"
                    className="text-xs text-muted-foreground opacity-50 hover:opacity-100"
                    onClick={() => {
                        const name = prompt('Name this layout preset:');
                        if (name) {
                        const preset: GridPreset = {
                            name,
                            columns: columnCount,
                            items: items.map(normalizeBlock),
                        };
                        const saved = JSON.parse(localStorage.getItem('grid_presets') || '[]');
                        localStorage.setItem('grid_presets', JSON.stringify([...saved, preset]));
                        alert(`Saved "${name}" as a new preset!`);
                        }
                    }}
                    >
                    💾 Save as Template
                    </Button>

              </div>
            )}
          </SortableContext>

          <DragOverlay>
            {draggingBlock && (
              <motion.div
                layout
                className="px-4 py-2 rounded border border-blue-500 bg-muted text-xs shadow-lg"
              >
                {draggingBlock.type}
              </motion.div>
            )}
          </DragOverlay>
        </DndContext>
      )}
    </>
  );
}
