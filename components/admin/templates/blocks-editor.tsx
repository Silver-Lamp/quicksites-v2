// components/admin/templates/blocks-editor.tsx
'use client';

import { useState } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, AlertTriangle } from 'lucide-react';

import { Button } from '@/components/ui';
import BlockSidebar from './block-sidebar';
import type { Block } from '@/types/blocks';
import type { BlocksEditorProps } from '@/types/blocks';
import { normalizeBlock } from '@/types/blocks';
import { industryPresets } from '@/lib/presets';
import { BlockSchema } from '@/admin/lib/zod/blockSchema';

type SortableBlockProps = {
  block: Block;
  index: number;
  onEdit: (index: number) => void;
};

function isBlockInvalid(block: Block): boolean {
  return !BlockSchema.safeParse(block).success;
}

function SortableBlock({ block, index, onEdit }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block.id || `block-${index}`,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const invalid = isBlockInvalid(block);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-2 border rounded p-3 ${
        invalid ? 'border-red-500 bg-red-500/10' : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="flex items-center gap-2">
        <GripVertical
          className="w-4 h-4 cursor-move text-muted-foreground"
          {...attributes}
          {...listeners}
        />
        <span className="text-sm font-medium text-white">{block.type}</span>
        {invalid && (
          <span className="flex items-center gap-1 text-xs text-red-400 ml-2">
            <AlertTriangle className="w-3 h-3" />
            Invalid block
          </span>
        )}
      </div>
      <Button size="sm" variant="ghost" onClick={() => onEdit(index)}>
        <Pencil className="w-4 h-4" />
      </Button>
    </div>
  );
}

export const BlocksEditor = ({ blocks, onChange, industry = 'default' }: BlocksEditorProps) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const ensureIds = (blocks: Block[]) =>
    blocks.map((block) => ({ ...block, id: block.id || crypto.randomUUID() }));

  const safeBlocks: (Block & { id: string })[] = ensureIds(blocks);

  const handleUpdate = (index: number, updatedBlock: Block) => {
    const updatedBlocks = [...safeBlocks];
    updatedBlocks[index] = normalizeBlock(updatedBlock);
    onChange(updatedBlocks);
  };

  const handleAddPreset = (type: string) => {
    const preset = (industryPresets[industry.toLowerCase()] || industryPresets.default)[type];
    const newBlock = normalizeBlock({ ...preset, type: type as Block['type'] });
    onChange([...safeBlocks, newBlock]);
  };

  const handleDragEnd = ({ active, over }: any) => {
    if (active.id !== over.id) {
      const oldIndex = safeBlocks.findIndex((b) => b.id === active.id);
      const newIndex = safeBlocks.findIndex((b) => b.id === over.id);
      const reordered = arrayMove(safeBlocks, oldIndex, newIndex);
      onChange(reordered);
    }
  };

  const availablePresets = industryPresets[industry.toLowerCase()] || industryPresets.default;

  return (
    <div className="space-y-4">
      <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={safeBlocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
          {safeBlocks.map((block, index) => (
            <SortableBlock
              key={block.id || `${block.type}-${index}`}
              block={block}
              index={index}
              onEdit={setSelectedIndex}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {Object.keys(availablePresets).map((type) => (
          <Button key={type} variant="outline" size="sm" onClick={() => handleAddPreset(type)}>
            + {type.charAt(0).toUpperCase() + type.slice(1)}
          </Button>
        ))}
      </div>

      {selectedIndex !== null && (
        <BlockSidebar
          block={safeBlocks[selectedIndex]}
          onChange={(updated) => handleUpdate(selectedIndex, updated)}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </div>
  );
};
