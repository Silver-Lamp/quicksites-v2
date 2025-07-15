'use client';

import type { Block } from '@/types/blocks';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import BlockEditor from './block-editor';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

type Props = {
  block: Block | null;
  errors?: BlockValidationError[];
  onSave: (updated: Block) => void;
  onClose: () => void;
  onOpen: boolean;
  onReplaceWithAI: (index: number) => void;
  onClone: (index: number) => void;
  onShowPrompt: (prompt: string, index: number) => void;
  onUndo: (index: number) => void;
  onViewDiff: (index: number) => void;
  undoAvailable: boolean;
};

export default function BlockSidebar({
  block,
  errors = [],
  onSave,
  onClose,
  onOpen,
  onReplaceWithAI,
  onClone,
  onShowPrompt,
  onUndo,
  onViewDiff,
  undoAvailable,
}: Props) {
  if (!block || typeof block._id !== 'string') return null;

  return (
    <Dialog open={onOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl dark:bg-neutral-900 text-black dark:text-white overflow-y-auto max-h-screen p-4">
        <DialogTitle>
          Edit Block: <code className="text-sm lowercase">{block.type}</code>
        </DialogTitle>

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded border border-red-300 dark:bg-red-900 dark:text-red-100 dark:border-red-700">
            <div className="font-semibold mb-1">Validation issues:</div>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {errors.map((err, i) => (
                <li key={i}>
                  <code className="text-red-600 dark:text-red-300">{err.field}</code>: {err.message}
                </li>
              ))}
            </ul>
          </div>
        )}


        <BlockEditor
          block={block}
          onSave={(updated) => {
            onSave(updated);
            onClose();
          }}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
