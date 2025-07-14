'use client';

import { blockMeta } from '@/admin/lib/zod/blockSchema';
import type { Block } from '@/types/blocks';
import { useState } from 'react';

type Props = {
  onAdd: (type: Block['type']) => void;
  label?: string;
};

export default function BlockAdder({ onAdd, label = 'Add Block' }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block text-left mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
      >
        {label}
      </button>

      {open && (
        <div className="absolute z-10 mt-2 w-56 rounded-md bg-white dark:bg-neutral-900 shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="py-1 max-h-80 overflow-y-auto">
            {Object.entries(blockMeta).map(([type, meta]) => (
              <button
                key={type}
                onClick={() => {
                  onAdd(type as Block['type']);
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                {meta.icon} {meta.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
