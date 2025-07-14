'use client';

import { useState, useMemo } from 'react';
import { blockMeta } from '@/admin/lib/zod/blockSchema';
import type { Block } from '@/types/blocks';

type Props = {
  onAdd: (type: Block['type']) => void;
  label?: string;
  disallowDuplicates?: Block['type'][];
  existingBlocks?: Block[];
};

export default function BlockAdderWithSearch({
  onAdd,
  label = 'Add Block',
  disallowDuplicates = ['footer'],
  existingBlocks = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const availableTypes = useMemo(() => {
    const blocked = new Set(
      existingBlocks
        .filter((b) => disallowDuplicates.includes(b.type))
        .map((b) => b.type)
    );

    return Object.entries(blockMeta).filter(
      ([type, meta]) =>
        type.toLowerCase().includes(search.toLowerCase()) &&
        !blocked.has(type as Block['type'])
    );
  }, [search, existingBlocks]);

  return (
    <div className="relative inline-block text-left mb-4 w-full max-w-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
      >
        {label}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full rounded-md bg-white dark:bg-neutral-900 shadow-lg ring-1 ring-black ring-opacity-5">
          <div className="p-2 border-b border-gray-200 dark:border-neutral-700">
            <input
              autoFocus
              type="text"
              placeholder="Search block types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded bg-gray-100 dark:bg-neutral-800 text-black dark:text-white"
            />
          </div>
          <div className="py-1 max-h-80 overflow-y-auto">
            {availableTypes.map(([type, meta]) => (
              <button
                key={type}
                onClick={() => {
                  onAdd(type as Block['type']);
                  setSearch('');
                  setOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-neutral-800"
              >
                {meta.icon} {meta.label}
              </button>
            ))}
            {availableTypes.length === 0 && (
              <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No blocks found</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
