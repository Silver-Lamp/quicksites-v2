// components/admin/templates/blocks-editor.tsx
'use client';

import { useState, useEffect } from 'react';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Pencil,
  AlertTriangle,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';
import BlockSidebar from './block-sidebar';
import type { Block, BlockWithId } from '@/types/blocks';
import { normalizeBlock } from '@/types/blocks';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

interface BlocksEditorPropsExtended {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  industry?: string;
  onReplaceWithAI?: (index: number) => void;
  onEdit?: (index: number) => void;
  colorMode?: 'light' | 'dark';
}

interface SortableBlockProps {
  block: BlockWithId;
  index: number;
  errors?: BlockValidationError[];
  onEdit: (index: number) => void;
  onReplaceWithAI?: (index: number) => void;
  onDelete: (index: number) => void;
  colorMode?: 'light' | 'dark';
}

function SortableBlock({
  block,
  index,
  errors = [],
  onEdit,
  onReplaceWithAI,
  onDelete,
  colorMode = 'dark',
}: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const invalid = errors.length > 0;
  const isAI = block.tags?.includes('ai');
  const wasAutofixed = block.tags?.includes('autofixed');

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`block-${block._id}`}
      className={`flex flex-col gap-2 border rounded p-3 ${
        invalid
          ? 'border-red-500 bg-red-500/10 animate-pulse shadow-red-500/30 shadow-md'
          : colorMode === 'dark'
            ? 'bg-black/5 border-black/10 text-white'
            : 'bg-white/5 border-white/10 text-black'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <GripVertical
            className="w-4 h-4 cursor-move text-muted-foreground"
            {...attributes}
            {...listeners}
          />
          <span className="text-sm font-medium">{block.type}</span>
          {wasAutofixed && (
            <Tooltip>
              <TooltipTrigger>
                <span className="text-xs text-yellow-300 ml-1 italic">🛠 Autofixed</span>
              </TooltipTrigger>
              <TooltipContent>This block was automatically repaired to pass validation.</TooltipContent>
            </Tooltip>
          )}
          {isAI && <span className="text-xs text-purple-400 ml-2">🔮 AI</span>}
          {invalid && (
            <span className="flex items-center gap-1 text-xs text-red-400 ml-2">
              <AlertTriangle className="w-3 h-3" />
              Invalid block
            </span>
          )}
        </div>

        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(index)}>
            <Pencil className="w-4 h-4" />
          </Button>
          {onReplaceWithAI && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (confirm('Replace this block with an AI-generated version?')) {
                  onReplaceWithAI(index);
                }
              }}
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700"
            onClick={() => {
              if (confirm('Delete this block?')) {
                onDelete(index);
              }
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {invalid && (
        <ul className="text-xs text-red-300 list-disc list-inside pl-1 pt-1 space-y-1">
          {errors.map((err, i) => (
            <li key={i}>
              <code className={colorMode === 'dark' ? 'text-white' : 'text-black'}>{err.field}</code>: {err.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const BlocksEditor = ({
  blocks,
  onChange,
  industry = 'default',
  onReplaceWithAI,
  onEdit,
  colorMode = 'dark',
}: BlocksEditorPropsExtended) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const ensureIds = (blocks: Block[]): BlockWithId[] =>
    blocks.map((block) => ({
      ...block,
      _id: block._id ?? crypto.randomUUID(),
    }));

  const blocksWithIds = ensureIds(blocks);

  const handleUpdate = (index: number, updatedBlock: Block) => {
    const updatedBlocks = [...blocksWithIds];
    updatedBlocks[index] = normalizeBlock(updatedBlock);
    onChange(updatedBlocks);
  };

  useEffect(() => {
    const first = blocksWithIds.find((b) => (b as any)._meta?.errorMessages?.length > 0);
    if (first) {
      const el = document.getElementById(`block-${first._id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [blocksWithIds]);

  return (
    <div className={`space-y-4 rounded p-3 ${colorMode === 'dark' ? 'bg-black/5 border-black/10 text-white' : 'bg-white/5 border-white/10 text-black'}`}>
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (active.id !== over?.id) {
            const oldIndex = blocksWithIds.findIndex((b) => b._id === active.id);
            const newIndex = blocksWithIds.findIndex((b) => b._id === over?.id);
            const reordered = arrayMove(blocksWithIds, oldIndex, newIndex);
            onChange(reordered);
          }
        }}
      >
        <SortableContext items={blocksWithIds.map((b) => b._id)} strategy={verticalListSortingStrategy}>
          {blocksWithIds.map((block, index) => (
            <SortableBlock
              key={block._id}
              block={block}
              index={index}
              errors={(block as any)._meta?.errorMessages as BlockValidationError[] || []}
              onReplaceWithAI={onReplaceWithAI}
              onEdit={setSelectedIndex}
              onDelete={(deleteIndex) => {
                const updated = [...blocksWithIds];
                updated.splice(deleteIndex, 1);
                onChange(updated);
              }}
              colorMode={colorMode}
            />
          ))}
        </SortableContext>
      </DndContext>

      {selectedIndex !== null && (
        <BlockSidebar
          block={blocksWithIds[selectedIndex]}
          errors={(blocksWithIds[selectedIndex] as any)._meta?.errorMessages || []}
          onSave={(updatedBlock) => {
            handleUpdate(selectedIndex, updatedBlock);
            setSelectedIndex(null);
          }}
          onClose={() => setSelectedIndex(null)}
          onOpen={true}
          onReplaceWithAI={() => {}}
          onClone={() => {}}
          onShowPrompt={() => {}}
          onUndo={() => {}}
          onViewDiff={() => {}}
          undoAvailable={false}
          colorMode={colorMode as 'light' | 'dark'}
        />
      )}
    </div>
  );
};
