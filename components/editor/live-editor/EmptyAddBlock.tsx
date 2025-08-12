'use client';

import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import SafeTriggerButton from '@/components/ui/safe-trigger-button';
import { PlusCircle } from 'lucide-react';

export default function EmptyAddBlock({
  onAdd,
  existingBlocks,
}: {
  onAdd: (type: string) => void;
  existingBlocks: any[];
}) {
  return (
    <div className="relative z-10 bg-white dark:bg-neutral-900 p-4 border-t border-gray-200 dark:border-neutral-700 mt-6">
      <BlockAdderGrouped
        onAdd={onAdd}
        existingBlocks={existingBlocks}
        triggerElement={
          <SafeTriggerButton
            onClick={() => {}}
            className="w-full flex items-center justify-center gap-2 border border-purple-600 text-purple-600 dark:text-purple-400 rounded px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Block</span>
          </SafeTriggerButton>
        }
      />
    </div>
  );
}
