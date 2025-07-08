'use client';

import {
  DndContext,
  closestCenter,
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
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, Plus } from 'lucide-react';
import { BlockWithId } from '@/types/blocks';

type Props = {
  blocks: BlockWithId[];
  onChange: (next: BlockWithId[]) => void;
  onBlockEdit?: (block: BlockWithId, index: number) => void;
  onInsertBlock?: (atIndex: number) => void;
};

export function SortableBlockList({
  blocks,
  onChange,
  onBlockEdit,
  onInsertBlock,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b._id === active.id);
    const newIndex = blocks.findIndex((b) => b._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(blocks, oldIndex, newIndex);
    onChange(reordered);
  };

  const handleDelete = (index: number) => {
    if (!confirm('Remove this block?')) return;
    const next = blocks.filter((_, i) => i !== index);
    onChange(next);
  };

  const handleInsert = (atIndex: number) => {
    if (onInsertBlock) onInsertBlock(atIndex);
  };

  return (
    <DndContext
      collisionDetection={closestCenter}
      sensors={sensors}
      onDragEnd={handleDragEnd}
    >      
      <SortableContext items={blocks.map((b) => b._id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          <AnimatePresence>
            {blocks.map((block, i) => {
              const isValid = BlockSchema.safeParse(block).success;

              return (
                <div key={block._id}>
                  {/* insertion zone above */}
                  {onInsertBlock && (
                    <div className="text-center my-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleInsert(i)}
                        className="text-xs opacity-50 hover:opacity-100"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Add Block Here
                      </Button>
                    </div>
                  )}

                  <SortableBlock id={block._id}>
                    <motion.div
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className={`rounded border px-3 py-2 text-sm flex justify-between items-center ${
                        isValid
                          ? 'border-gray-700 bg-white/5'
                          : 'border-red-500 bg-red-500/10'
                      }`}
                    >
                      <div>{block?.type || '(unknown)'}</div>
                      <div className="flex gap-1">
                        {onBlockEdit && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => onBlockEdit(block, i)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(i)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </motion.div>
                  </SortableBlock>
                </div>
              );
            })}

            {blocks.length === 0 && (
              <motion.div
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                className="text-xs text-muted-foreground italic px-2 py-4 border border-dashed border-gray-600 rounded text-center"
              >
                No blocks yet. Drag or insert to begin.
              </motion.div>
            )}

            {/* insertion zone at end */}
            {onInsertBlock && (
              <div className="text-center my-1">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => handleInsert(blocks.length)}
                  className="text-xs opacity-50 hover:opacity-100"
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Block to End
                </Button>
              </div>
            )}
          </AnimatePresence>
        </div>
      </SortableContext>
    </DndContext>
  );
}
