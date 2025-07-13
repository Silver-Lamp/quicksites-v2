'use client';

import { Dialog, DialogContent, Button } from '@/components/ui';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import type { Block } from '@/types/blocks';
import BlockEditor from './block-editor';

export default function BlockEditorModal({
  open,
  onClose,
  block,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  block: Block;
  onSave: (updated: Block) => void;
}) {
  const [currentBlock, setCurrentBlock] = useState<Block>(block);

  useEffect(() => {
    setCurrentBlock(block);
  }, [block]);

  const handleSave = (updated: Block) => {
    onSave(updated);
    toast.success('Block updated');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white max-w-2xl max-h-screen overflow-y-auto">
        <h2 className="text-lg font-bold mb-4">Edit Block</h2>
        <BlockEditor
          block={currentBlock}
          onSave={handleSave}
          onClose={onClose}
        />
      </DialogContent>
    </Dialog>
  );
}
