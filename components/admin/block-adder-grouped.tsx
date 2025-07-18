// components/admin/block-adder-grouped.tsx
'use client';

import { useState, useMemo } from 'react';
import { blockMeta } from '@/admin/lib/zod/blockSchema';
import type { Block } from '@/types/blocks';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlockMini from '@/components/admin/templates/render-block-mini';

// Group definitions
const blockGroups: Record<string, { label: string; types: Block['type'][] }> = {
  content: {
    label: 'Content Blocks',
    types: ['text', 'quote', 'testimonial', 'video', 'audio'],
  },
  layout: {
    label: 'Layout',
    types: ['grid', 'footer'],
  },
  callToAction: {
    label: 'Calls to Action',
    types: ['hero', 'cta', 'button'],
  },
  services: {
    label: 'Business Features',
    types: ['services'],
  },
};

// Collapsed state persistence
function loadCollapsedGroups(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const saved = localStorage.getItem('collapsedBlockGroups');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveCollapsedGroups(groups: Record<string, boolean>) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('collapsedBlockGroups', JSON.stringify(groups));
  }
}

type Props = {
  onAdd: (type: Block['type']) => void;
  existingBlocks?: Block[];
  disallowDuplicates?: Block['type'][];
  label?: string;
};

export default function BlockAdderGrouped({
  onAdd,
  existingBlocks = [],
  disallowDuplicates = ['footer'],
  label = 'Add Block',
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    loadCollapsedGroups()
  );

  const blocked = new Set(
    existingBlocks.filter((b) => disallowDuplicates.includes(b.type)).map((b) => b.type)
  );

  const filtered = useMemo(() => {
    return Object.entries(blockGroups).map(([key, group]) => {
      const matches = group.types.filter((type) => {
        return (
          !blocked.has(type) &&
          blockMeta[type as keyof typeof blockMeta]?.label.toLowerCase().includes(search.toLowerCase())
        );
      });
      return { key, label: group.label, types: matches };
    });
  }, [search, existingBlocks]);

  return (
    <div className="relative inline-block text-left w-full max-w-sm mb-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
      >
        {label}
      </button>

      {open && (
        <div className="absolute z-30 mt-2 w-full rounded-md bg-white dark:bg-neutral-900 shadow-lg ring-1 ring-black ring-opacity-5 max-h-[32rem] overflow-y-auto">
          <div className="p-2 border-b border-gray-200 dark:border-neutral-700">
            <input
              autoFocus
              type="text"
              placeholder="Search block types..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {filtered.map(({ key, label, types }) => (
            <div key={key} className="border-b border-gray-200 dark:border-neutral-700">
              <button
                className="w-full text-left px-4 py-2 font-medium text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700"
                onClick={() => {
                  const next = { ...collapsedGroups, [key]: !collapsedGroups[key] };
                  setCollapsedGroups(next);
                  saveCollapsedGroups(next);
                }}
              >
                {label}
              </button>

              {!collapsedGroups[key] && (
                <div className="pl-4 py-2 grid grid-cols-1 gap-2">
                  {types.length > 0 ? (
                    types.map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          onAdd(type);
                          setSearch('');
                          setOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 flex items-center gap-3"
                      >
                        <div className="flex-shrink-0 text-lg">{blockMeta[type as keyof typeof blockMeta].icon}</div>
                        <div className="flex-grow">
                          <div className="font-medium text-gray-800 dark:text-white">
                            {blockMeta[type as keyof typeof blockMeta].label}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Block type: {type}
                          </div>
                        </div>
                        <div className="w-28 h-16">
                          <RenderBlockMini block={createDefaultBlock(type)} className="h-full" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-2 py-1 text-sm text-gray-400 dark:text-gray-500">
                      None available
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {filtered.every((g) => g.types.length === 0) && (
            <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
              No matching block types found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
