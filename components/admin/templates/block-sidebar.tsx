// components/admin/templates/block-sidebar.tsx
'use client';

import type { Block } from '@/types/blocks';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import BlockEditor from './block-editor';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import type { Template } from '@/types/template';
import { useMemo } from 'react';

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

function preview(val: unknown, max = 140) {
  try {
    const s = typeof val === 'string' ? val : JSON.stringify(val);
    return s.length > max ? s.slice(0, max) + '…' : s;
  } catch {
    return String(val);
  }
}

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

  // Group incoming errors by field to make the panel easier to scan
  const grouped = useMemo(() => {
    const g: Record<string, BlockValidationError[]> = {};
    for (const e of errors) {
      const key = e.field || '(root)';
      (g[key] ??= []).push(e);
    }
    return g;
  }, [errors]);

  const copyDetails = async () => {
    try {
      const payload = { blockId: block._id, type: block.type, errors };
      await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    } catch {
      /* noop */
    }
  };

  return (
    <Dialog open={onOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl dark:bg-neutral-900 text-black dark:text-white overflow-y-auto max-h-screen p-4">
        <DialogTitle>
          Edit Block:{' '}
          <code className="text-sm lowercase">{block.type}</code>
        </DialogTitle>

        {errors.length > 0 && (
          <div className="mb-4 p-3 bg-red-100 text-red-800 rounded border border-red-300 dark:bg-red-900 dark:text-red-100 dark:border-red-700">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Validation issues</div>
              <button
                onClick={copyDetails}
                className="text-xs px-2 py-1 rounded bg-red-800/20 border border-red-700/50 text-red-100 hover:bg-red-800/30"
                title="Copy error details"
              >
                Copy details
              </button>
            </div>

            <div className="mt-2 text-xs opacity-80">
              Block <code>{block._id}</code> • type <code>{block.type}</code>
            </div>

            <div className="mt-2 space-y-2 text-sm">
              {Object.entries(grouped).map(([field, list]) => (
                <div key={field} className="border-t border-red-500/20 pt-2 first:border-0 first:pt-0">
                  <div className="mb-1">
                    <code className="px-1.5 py-0.5 rounded bg-red-950/40 border border-red-800/50 text-red-100 text-[11px]">
                      {field}
                    </code>
                  </div>
                  <ul className="space-y-1">
                    {list.map((e, i) => (
                      <li key={i}>
                        <div className="flex flex-wrap items-baseline gap-2">
                          <span className="text-red-100">{e.message}</span>
                          {e.code && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-amber-100 text-[11px]">
                              {e.code}
                            </span>
                          )}
                        </div>

                        {(e.expected !== undefined ||
                          e.received !== undefined ||
                          e.hint) && (
                          <div className="ml-1 mt-0.5 text-[12px] text-red-50/90 space-y-0.5">
                            {e.expected !== undefined && (
                              <div>
                                <span className="opacity-70">expected:</span>{' '}
                                <code className="text-red-50">{preview(e.expected)}</code>
                              </div>
                            )}
                            {e.received !== undefined && (
                              <div>
                                <span className="opacity-70">received:</span>{' '}
                                <code className="text-red-50">{preview(e.received)}</code>
                              </div>
                            )}
                            {e.hint && (
                              <div>
                                <span className="opacity-70">hint:</span> {e.hint}
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
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
