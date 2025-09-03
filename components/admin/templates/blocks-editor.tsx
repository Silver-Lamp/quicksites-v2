// components/admin/templates/blocks-editor.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { validateBlockRich } from '@/hooks/validateTemplateBlocks';
import type { Template } from '@/types/template';

interface BlocksEditorPropsExtended {
  blocks: Block[];
  onChange: (blocks: Block[]) => void;
  industry?: string;
  onReplaceWithAI?: (index: number) => void;
  onEdit?: (index: number) => void;
  colorMode?: 'light' | 'dark';
  template: Template;
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
          ? 'border-red-500 bg-red-500/10 shadow-red-500/30 shadow-md'
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
              <TooltipContent>
                This block was automatically repaired to pass validation.
              </TooltipContent>
            </Tooltip>
          )}

          {isAI && <span className="text-xs text-purple-400 ml-2">🔮 AI</span>}

          {invalid && (
            <span className="flex items-center gap-1 text-xs text-red-400 ml-2" title={errors[0]?.message}>
              <AlertTriangle className="w-3 h-3" />
              Invalid ({errors.length})
            </span>
          )}
        </div>

        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => onEdit(index)} title="Edit">
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
              title="Replace with AI"
            >
              <Sparkles className="w-4 h-4 text-purple-400" />
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-red-500 hover:text-red-700"
            onClick={() => {
              if (confirm('Delete this block?')) onDelete(index);
            }}
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {invalid && (
        <ul className="text-xs text-red-300 list-disc list-inside pl-1 pt-1 space-y-1">
          {errors.map((err, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span>{err.message}</span>
                {err.field && (
                  <code className={colorMode === 'dark' ? 'text-white' : 'text-black'}>
                    {err.field}
                  </code>
                )}
                {err.code && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-amber-100 text-[10px]">
                    {err.code}
                  </span>
                )}
              </div>
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
  template,
}: BlocksEditorPropsExtended) => {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const ensureIds = (blocks: Block[]): BlockWithId[] =>
    blocks.map((block) => ({
      ...block,
      _id: block._id ?? crypto.randomUUID(),
    }));

  const blocksWithIds = ensureIds(blocks);

  // 🔎 Compute rich validation errors per block (id → errors[])
  const errorsMap: Record<string, BlockValidationError[]> = useMemo(() => {
    const m: Record<string, BlockValidationError[]> = {};
    for (const b of blocksWithIds) {
      m[b._id] = validateBlockRich(b as Block);
    }
    return m;
  }, [blocksWithIds]);

  const handleUpdate = (index: number, updatedBlock: Block) => {
    const updatedBlocks = [...blocksWithIds];
    updatedBlocks[index] = normalizeBlock(updatedBlock);
    onChange(updatedBlocks);
  };

  // Scroll to first invalid block
  useEffect(() => {
    const firstInvalid = blocksWithIds.find((b) => (errorsMap[b._id] || []).length > 0);
    if (firstInvalid) {
      const el = document.getElementById(`block-${firstInvalid._id}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [blocksWithIds, errorsMap]);

  return (
    <div
      className={`space-y-4 rounded p-3 ${
        colorMode === 'dark'
          ? 'bg-black/5 border-black/10 text-white'
          : 'bg-white/5 border-white/10 text-black'
      }`}
    >
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          const oldIndex = blocksWithIds.findIndex((b) => b._id === active.id);
          const newIndex = blocksWithIds.findIndex((b) => b._id === over.id);
          if (oldIndex === -1 || newIndex === -1) return;
          const reordered = arrayMove(blocksWithIds, oldIndex, newIndex);
          onChange(reordered);
        }}
      >
        <SortableContext items={blocksWithIds.map((b) => b._id)} strategy={verticalListSortingStrategy}>
          {blocksWithIds.map((block, index) => (
            <SortableBlock
              key={block._id}
              block={block}
              index={index}
              errors={errorsMap[block._id] || []}
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
          errors={errorsMap[blocksWithIds[selectedIndex]._id] || []}
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
          template={template as unknown as Template}
        />
      )}
    </div>
  );
};
