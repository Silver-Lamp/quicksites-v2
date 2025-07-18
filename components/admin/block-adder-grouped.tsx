'use client';

import { useState, useMemo, useEffect } from 'react';
import { blockMeta } from '@/admin/lib/zod/blockSchema';
import type { Block } from '@/types/blocks';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlockMini from '@/components/admin/templates/render-block-mini';

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
  triggerElement?: React.ReactNode;
};

export default function BlockAdderGrouped({
  onAdd,
  existingBlocks = [],
  disallowDuplicates = ['footer'],
  label = 'Add Block',
  triggerElement,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() =>
    loadCollapsedGroups()
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

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
    <>
      <div onClick={() => setOpen(true)}>
        {triggerElement ? (
          triggerElement
        ) : (
          <button
            className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-center"
          >
            {label}
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-black/10 dark:border-white/10">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">
                {label}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-sm text-gray-500 hover:text-red-500 dark:text-gray-400"
              >
                ✕
              </button>
            </div>

            <div className="p-4 border-b border-gray-200 dark:border-neutral-700">
              <input
                autoFocus
                type="text"
                placeholder="Search block types..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="p-4 space-y-6">
              {filtered.map(({ key, label, types }) => (
                <div key={key}>
                  <button
                    className="w-full text-left px-4 py-2 font-medium text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded"
                    onClick={() => {
                      const next = { ...collapsedGroups, [key]: !collapsedGroups[key] };
                      setCollapsedGroups(next);
                      saveCollapsedGroups(next);
                    }}
                  >
                    {label}
                  </button>

                  {!collapsedGroups[key] && (
                    <div className="pt-2 flex flex-col gap-4 px-4">
                      {types.length > 0 ? (
                        types.map((type) => (
                          <button
                            key={type}
                            onClick={() => {
                              onAdd(type);
                              setSearch('');
                              setOpen(false);
                            }}
                            className="text-left px-4 py-4 rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-gray-50 dark:hover:bg-neutral-800 space-y-3 text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <div className="text-lg">
                                {blockMeta[type as keyof typeof blockMeta].icon}
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 dark:text-white">
                                  {blockMeta[type as keyof typeof blockMeta].label}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  Block type: {type}
                                </div>
                              </div>
                            </div>
                            <div className="w-full border rounded overflow-hidden">
                              <RenderBlockMini block={createDefaultBlock(type)} className="w-full h-32" />
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
          </div>
        </div>
      )}
    </>
  );
}
