'use client';

import type { Block } from '@/types/blocks';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import BlockEditor from './block-editor';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { Template } from '@/types/template';

type Props = {
  block: Block | null;
  errors?: BlockValidationError[];
  onSave: (updated: Block) => void;
  onClose: () => void;
  onOpen: boolean;
  onReplaceWithAI?: (index: number) => void;
  onClone?: (index: number) => void;
  onShowPrompt?: (prompt: string, index: number) => void;
  onUndo?: (index: number) => void;
  onViewDiff?: (index: number) => void;
  undoAvailable?: boolean;
  colorMode?: 'light' | 'dark';
  template: Template;
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
  undoAvailable = false,
  colorMode = 'dark',
  template,
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
          colorMode={colorMode as 'light' | 'dark'}
          template={template as unknown as Template}
        />

        {(onReplaceWithAI || onClone || onUndo || onViewDiff) && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {onReplaceWithAI && (
              <button
                onClick={() => onReplaceWithAI(0)}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1 rounded"
              >
                🤖 Replace with AI
              </button>
            )}
            {onClone && (
              <button
                onClick={() => onClone(0)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
              >
                📋 Clone Block
              </button>
            )}
            {onUndo && (
              <button
                disabled={!undoAvailable}
                onClick={() => onUndo(0)}
                className="bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 text-black px-3 py-1 rounded"
              >
                ↩ Undo
              </button>
            )}
            {onViewDiff && (
              <button
                onClick={() => onViewDiff(0)}
                className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-1 rounded"
              >
                🪞 View Diff
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
