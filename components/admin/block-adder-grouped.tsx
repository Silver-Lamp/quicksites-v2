// components/admin/block-adder-grouped.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import { blockMeta } from '@/admin/lib/zod/blockSchema';
import type { Block } from '@/types/blocks';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlockMini from '@/components/admin/templates/render-block-mini';
import SafeTriggerButton from '@/components/ui/safe-trigger-button';
import { Sparkles } from 'lucide-react';
import type { Template } from '@/types/template';

const blockGroups: Record<string, { label: string; types: Block['type'][] }> = {
  content: {
    label: 'Content Blocks',
    types: ['text', 'quote', 'faq', 'testimonial', 'video', 'audio', 'chef_profile', 'meal_card', 'reviews_list'],
  },
  layout: {
    label: 'Layout',
    types: ['grid'],
  },
  callToAction: {
    label: 'Calls to Action',
    types: ['hero', 'cta', 'contact_form', 'button'],
  },
  services: {
    label: 'Business Features',
    types: ['services', 'service_areas'],
  },
};

// ✅ Which block types have built-in AI assist in the editor
const AI_ENABLED_TYPES = new Set<Block['type']>(['text'] as Block['type'][]);
const isAiType = (t: Block['type']) => AI_ENABLED_TYPES.has(t);

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
  colorMode?: 'light' | 'dark';
  template: Template;
};

export default function BlockAdderGrouped({
  onAdd,
  existingBlocks = [],
  disallowDuplicates = ['footer', 'header'],
  label = 'Add Block',
  triggerElement,
  colorMode = 'dark',
  template,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => loadCollapsedGroups());

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
    const q = search.trim().toLowerCase();
    const wantsAi = q && /(^|[^a-z])ai([^a-z]|$)|copy|write|generate/.test(q);
    return Object.entries(blockGroups).map(([key, group]) => {
      const matches = group.types.filter((type) => {
        if (blocked.has(type)) return false;
        const label = (blockMeta[type as keyof typeof blockMeta]?.label || '').toLowerCase();
        const t = String(type).toLowerCase();
        const hit =
          !q ||
          label.includes(q) ||
          t.includes(q) ||
          (wantsAi && isAiType(type)); // typing "ai" shows AI-capable blocks
        return hit;
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
          <SafeTriggerButton
            onClick={() => setOpen(true)}
            className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-center"
          >
            {label}
          </SafeTriggerButton>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto border border-black/10 dark:border-white/10">
            <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{label}</h2>
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
                placeholder='Search block types… (try "ai")'
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="p-4 space-y-6">
              {filtered.map(({ key, label, types }) => (
                <div key={key}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      const next = { ...collapsedGroups, [key]: !collapsedGroups[key] };
                      setCollapsedGroups(next);
                      saveCollapsedGroups(next);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        const next = { ...collapsedGroups, [key]: !collapsedGroups[key] };
                        setCollapsedGroups(next);
                        saveCollapsedGroups(next);
                      }
                    }}
                    className="w-full text-left px-4 py-2 font-medium text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded cursor-pointer"
                  >
                    {label}
                  </div>

                  {!collapsedGroups[key] && (
                    <div className="pt-2 flex flex-col gap-4 px-4">
                      {types.length > 0 ? (
                        types.map((type) => {
                          const meta = blockMeta[type as keyof typeof blockMeta];
                          return (
                            <div
                              key={type}
                              role="button"
                              tabIndex={0}
                              onClick={() => {
                                onAdd(type);
                                setSearch('');
                                setOpen(false);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onAdd(type);
                                  setSearch('');
                                  setOpen(false);
                                }
                              }}
                              className={[
                                'text-left px-4 py-4 rounded-md border bg-white dark:bg-neutral-900 space-y-3 cursor-pointer',
                                'border-gray-300 dark:border-neutral-700',
                                'hover:bg-gray-50 dark:hover:bg-neutral-800',
                              ].join(' ')}
                            >
                              {/* Title row with AI badge */}
                              <div className="flex items-center gap-2">
                                <div className="text-lg">{meta.icon}</div>
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-800 dark:text-white truncate">
                                    {meta.label}
                                  </div>
                                  <div className="text-xs text-gray-500 dark:text-gray-400">
                                    Block type: {type}
                                  </div>
                                </div>

                                {isAiType(type) && (
                                  <span
                                    title="AI-enabled: generate & rewrite content in the editor (⌘/Ctrl + J)"
                                    className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]
                                               bg-purple-100 text-purple-700 border-purple-300
                                               dark:bg-purple-600/15 dark:text-purple-200 dark:border-purple-500/40"
                                  >
                                    <Sparkles className="h-3 w-3" />
                                    AI
                                  </span>
                                )}
                              </div>

                              {/* Optional AI note (only for Text) */}
                              {isAiType(type) && (
                                <div className="text-xs text-purple-700 dark:text-purple-300">
                                  Built-in AI writing: intros, FAQs, CTAs, blog ideas, rewrite, shorten, expand.
                                </div>
                              )}

                              {/* Mini preview with corner badge */}
                              <div className="relative w-full border rounded overflow-hidden border-gray-300 dark:border-neutral-700">
                                <RenderBlockMini
                                  block={createDefaultBlock(type) as any}
                                  className="w-full h-32"
                                  showDebug={false}
                                  colorMode={colorMode}
                                  template={template}
                                />
                                {isAiType(type) && (
                                  <span className="pointer-events-none absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-600 text-white shadow">
                                    ✨ AI
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })
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
