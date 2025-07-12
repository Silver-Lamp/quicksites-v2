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
import { GripVertical, Pencil, AlertTriangle, Sparkles, Brain, Copy } from 'lucide-react';

import { Button } from '@/components/ui';
import BlockSidebar from './block-sidebar';
import type { Block, BlockWithId, BlocksEditorProps } from '@/types/blocks';
import { normalizeBlock } from '@/types/blocks';
import { industryPresets } from '@/lib/presets';
import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Modal } from '@/components/ui/modal';
import { RenderChangedFields } from '@/components/ui/render-changed-fields';

interface BlocksEditorPropsExtended extends BlocksEditorProps {
  onReplaceWithAI?: (index: number) => void;
  onEdit?: (index: number) => void;
}

interface SortableBlockProps {
  block: BlockWithId;
  index: number;
  onEdit: (index: number) => void;
  onReplaceWithAI?: (index: number) => void;
  onClone?: (index: number) => void;
  onShowPrompt?: (prompt: string, index: number) => void;
  onUndo?: (index: number) => void;
  onViewDiff?: (index: number) => void;
  undoAvailable?: boolean;
}

function isBlockInvalid(block: Block): boolean {
  return !BlockSchema.safeParse(block).success;
}

function SortableBlock({ block, index, onEdit, onReplaceWithAI, onClone, onShowPrompt, onUndo, onViewDiff, undoAvailable }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block._id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const invalid = isBlockInvalid(block);
  const isAI = block.tags?.includes('ai');
  const hasPrompt = typeof block.meta?.prompt === 'string';
  const wasAutofixed = block.tags?.includes('autofixed');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between gap-2 border rounded p-3 ${
        invalid ? 'border-red-500 bg-red-500/10 animate-pulse shadow-red-500/30 shadow-md' : 'bg-white/5 border-white/10'
      }`}
    >
      <div className="flex items-center gap-2">
        <GripVertical
          className="w-4 h-4 cursor-move text-muted-foreground"
          {...attributes}
          {...listeners}
        />
        <span className="text-sm font-medium text-white">{block.type}</span>
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
          <span className="flex items-center gap-1 text-xs text-red-400 ml-2">
            <AlertTriangle className="w-3 h-3" />
            Invalid block
          </span>
        )}
      </div>
      <div className="flex gap-1">
        {wasAutofixed && onViewDiff && (
          <Tooltip>
            <TooltipTrigger>
            <Button size="sm" variant="ghost" onClick={() => onViewDiff(index)}>
              View Diff
            </Button>
            </TooltipTrigger>
            <TooltipContent>
              View difference
            </TooltipContent>
          </Tooltip>
        )}
        {hasPrompt && onShowPrompt && (
          <Tooltip>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onShowPrompt(block.meta?.prompt || '', index)}
            >
              <Brain className="w-4 h-4 text-purple-300" />
            </Button>
          </Tooltip>
        )}
        {undoAvailable && onUndo && (
          <Tooltip>
            <TooltipTrigger>
            <Button size="sm" variant="ghost" onClick={() => onUndo(index)}>
              ⎌ Undo
            </Button>
            </TooltipTrigger>
            <TooltipContent>
              Undo Autofix
            </TooltipContent>
          </Tooltip>
        )}
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
        {onClone && (
          <Button size="sm" variant="ghost" onClick={() => onClone(index)}>
            <Copy className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export const BlocksEditor = ({ blocks, onChange, industry = 'default', onReplaceWithAI, onEdit }: BlocksEditorPropsExtended) => {
  const [diffIndex, setDiffIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [promptData, setPromptData] = useState<{ prompt: string; index: number } | null>(null);
  const [responseText, setResponseText] = useState<string>('');
  const [responseHistory, setResponseHistory] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const ensureIds = (blocks: Block[]): BlockWithId[] =>
    blocks.map((block) => ({
      ...block,
      _id: block._id ?? crypto.randomUUID(),
    }));

  const [safeBlocks, setSafeBlocks] = useState<BlockWithId[]>(ensureIds(blocks));
  const [undoMap, setUndoMap] = useState<Record<string, BlockWithId>>({});

  const handleUpdate = (index: number, updatedBlock: Block) => {
    const updatedBlocks = [...safeBlocks];
    updatedBlocks[index] = normalizeBlock(updatedBlock);
    onChange(updatedBlocks);
  };

  const regenerateFromPrompt = async () => {
    if (!promptData?.prompt) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/blocks/rag/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPrompt: promptData.prompt,
          originalText: '',
          blockType: safeBlocks[promptData.index]?.type,
          industry,
        }),
      });
      const data = await res.json();
      if (data.rewritten) {
        setResponseText(data.rewritten);
        setResponseHistory((prev) => [...prev, data.rewritten]);
      }
    } catch (e) {
      console.error('Failed to regenerate:', e);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => document.querySelectorAll('[data-diff-toggle]').forEach(el => (el as HTMLElement).style.display = 'block')}>
          Expand All Diffs
        </Button>
        <Button size="sm" variant="ghost" onClick={() => document.querySelectorAll('[data-diff-toggle]').forEach(el => (el as HTMLElement).style.display = 'none')}>
          Collapse All Diffs
        </Button>
      </div>
      <Modal show={!!promptData} onClose={() => setPromptData(null)} title="🔍 GPT Prompt + Edit">
        <textarea
          className="w-full border rounded bg-zinc-800 text-white p-2 text-sm mb-4"
          rows={5}
          value={promptData?.prompt || ''}
          onChange={(e) => setPromptData((prev) => prev && { ...prev, prompt: e.target.value })}
        />
        <div className="flex justify-between items-center mb-3">
          <Button variant="secondary" onClick={regenerateFromPrompt} disabled={isLoading}>
            {isLoading ? 'Thinking...' : 'Regenerate with GPT'}
          </Button>
        </div>
        {responseHistory.length > 0 && (
          <div className="space-y-4">
            {responseHistory.map((resp, i) => (
              <div key={i} className="p-2 text-sm bg-white/5 rounded border space-y-2">
                <div>{resp}</div>
                <div className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (promptData) {
                        const updated = [...safeBlocks];
                        updated[promptData.index] = {
                          ...updated[promptData.index],
                          type: 'text',
                          content: { value: resp },
                          meta: { ...updated[promptData.index].meta, prompt: promptData.prompt },
                          tags: [...new Set([...(updated[promptData.index].tags || []), 'ai'])],
                        };
                        onChange(updated);
                        setPromptData(null);
                      }
                    }}
                  >
                    Apply This
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <DndContext collisionDetection={closestCenter} onDragEnd={({ active, over }) => {
        if (active.id !== over?.id) {
          const oldIndex = safeBlocks.findIndex((b) => b._id === active.id);
          const newIndex = safeBlocks.findIndex((b) => b._id === over?.id);
          const reordered = arrayMove(safeBlocks, oldIndex, newIndex);
          onChange(reordered);
        }
      }}>
        <SortableContext items={safeBlocks.map((b) => b._id)} strategy={verticalListSortingStrategy}>
          {safeBlocks.map((block, index) => (
            <SortableBlock
              key={block._id}
              block={block}
              index={index}
              onEdit={setSelectedIndex}
              onViewDiff={setDiffIndex}
              onReplaceWithAI={onReplaceWithAI}
              onShowPrompt={(prompt, idx) => setPromptData({ prompt, index: idx })}
              onUndo={(id) => {
                const prev = undoMap[id];
                if (prev) onChange(safeBlocks.map((b) => (b._id === id.toString() ? prev : b)));
              }}
              undoAvailable={!!undoMap[block._id!.toString()]}
            />
          ))}
        </SortableContext>
      </DndContext>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {(industryPresets[industry.toLowerCase()] || industryPresets.default) &&
          Object.keys(industryPresets[industry.toLowerCase()] || industryPresets.default).map((type) => {
            const preset = (industryPresets[industry.toLowerCase()] || industryPresets.default)[type];
            const newBlock = normalizeBlock({ ...preset, type } as Block);
            const isValid = BlockSchema.safeParse(newBlock).success;
            return (
              <Button
                key={type}
                variant={isValid ? 'outline' : 'destructive'}
                size="sm"
                onClick={() => {
                  setUndoMap((prev) => ({ ...prev, [newBlock._id!]: newBlock }));
                  onChange([...safeBlocks, newBlock]);
                }}
              >
                + {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            );
        })}
      </div>

      {selectedIndex !== null && (
        <BlockSidebar
          block={safeBlocks[selectedIndex]}
          onChange={(updatedBlock) => handleUpdate(selectedIndex, updatedBlock)}
          errors={BlockSchema.safeParse(safeBlocks[selectedIndex]).success ? undefined : ['Invalid structure']}
          onClose={() => setSelectedIndex(null)}
        />
      )}

      {diffIndex !== null && (
        <Modal show onClose={() => setDiffIndex(null)} title="Block Diff View">
          <RenderChangedFields
            original={undoMap[safeBlocks[diffIndex]._id!]}
            modified={safeBlocks[diffIndex]}
            view="inline"
          />
        </Modal>
      )}
    </div>
  );
};
