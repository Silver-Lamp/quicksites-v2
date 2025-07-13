'use client';

import type { Block } from '@/types/blocks';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import BlockEditor from './block-editor';

type Props = {
  block: Block | null;
  errors?: string[];
  onSave: (updated: Block) => void;
  onClose: () => void;
  onOpen: boolean;
};

export default function BlockSidebar({ block, errors = [], onSave, onClose, onOpen }: Props) {
  if (!block || typeof block._id !== 'string') {
    return null;
  }

  return (
    <Dialog open={onOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-white dark:bg-neutral-900 text-black dark:text-white overflow-y-auto max-h-screen p-4">
        <DialogTitle>
          Edit Block: <code className="text-sm lowercase">{block.type}</code>
        </DialogTitle>

        {errors.length > 0 && (
          <div className="mb-4 p-2 bg-red-100 text-red-800 rounded text-sm dark:bg-red-900 dark:text-red-200">
            <ul className="list-disc pl-4">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
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
