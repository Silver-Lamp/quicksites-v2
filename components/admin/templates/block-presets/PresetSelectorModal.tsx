'use client';

import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PresetSelector from './preset-selector';
import PresetPreviewCard from './PresetPreviewCard';
import type { BlockWithId } from '@/types/blocks';

export default function PresetSelectorModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (block: BlockWithId) => void;
}) {
  const [hovered, setHovered] = useState<BlockWithId | null>(null);

  const handleSelect = (block: BlockWithId) => {
    onSelect(block);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl bg-white dark:bg-neutral-900 p-4 max-h-screen overflow-y-auto">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
          Choose a Block Type
        </h3>

        <div className="flex gap-6">
          <div className="flex-1">
            <PresetSelector onSelect={handleSelect} onHover={setHovered} />
          </div>
          <div className="w-64 hidden md:block">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">Live Preview:</div>
            {hovered ? (
              <PresetPreviewCard block={hovered} />
            ) : (
              <div className="text-xs text-gray-400 italic">Hover over a block to preview</div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}