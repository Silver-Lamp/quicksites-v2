'use client';

import { CSS } from '@dnd-kit/utilities';
import { useSortable } from '@dnd-kit/sortable';
import { GripVertical, Pencil, AlertTriangle, Sparkles } from 'lucide-react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui';
import type { Block } from '@/types/blocks';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

type Props = {
  block: Block;
  index: number;
  errors?: BlockValidationError[];
  onEdit: (index: number) => void;
  onReplaceWithAI?: (index: number) => void;
  onUndo?: (index: number) => void;
  onViewDiff?: (index: number) => void;
  undoAvailable?: boolean;
  children?: React.ReactNode;
};

export default function SortableBlock({
  block,
  index,
  errors = [],
  onEdit,
  onReplaceWithAI,
  onUndo,
  onViewDiff,
  undoAvailable,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: block._id as string,
  });

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
          : 'bg-white/5 border-white/10'
      }`}
    >
      {/* Block Header */}
      <div className="flex items-center justify-between gap-2">
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
              Invalid ({errors.length})
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
        </div>
      </div>

      {/* Validation Errors */}
      {invalid && (
        <ul className="text-xs text-red-300 list-disc list-inside pl-1 pt-1 space-y-1">
          {errors.map((err, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span>{err.message}</span>
                {err.field && <code className="text-white">{err.field}</code>}
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
