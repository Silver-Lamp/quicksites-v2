// components/admin/block-adder-grouped.tsx
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { blockMeta } from '@/admin/lib/zod/blockSchema';
import type { Block } from '@/types/blocks';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlockMini from '@/components/admin/templates/render-block-mini';
import SafeTriggerButton from '@/components/ui/safe-trigger-button';
import {
  Sparkles,
  Type as TypeIcon,
  Mail,
  Image as ImageIcon,
  HelpCircle,
  Clock,
  ShoppingCart,
  CalendarDays, // ⬅️ NEW (scheduler quick pick)
} from 'lucide-react';
import type { Template } from '@/types/template';

const blockGroups: Record<string, { label: string; types: Block['type'][] }> = {
  callToAction: { label: 'Calls to Action', types: ['hero', 'contact_form'] },
  services:     { label: 'Business Features', types: ['services', 'service_areas', 'hours', 'scheduler'] }, // ⬅️ add scheduler
  // E-commerce
  ecommerce:    { label: 'E-commerce', types: ['products_grid', 'service_offer'] },
  content:      { label: 'Content Blocks', types: ['text', 'quote', 'faq', 'testimonial', 'video', 'audio'] },
};

const QUICK_PICKS: Array<{ type: Block['type']; label: string; Icon: any }> = [
  { type: 'text',          label: 'Text',      Icon: TypeIcon },
  { type: 'contact_form',  label: 'Contact',   Icon: Mail },
  { type: 'hero',          label: 'Hero',      Icon: ImageIcon },
  { type: 'faq',           label: 'FAQ',       Icon: HelpCircle },
  { type: 'hours',         label: 'Hours',     Icon: Clock },
  { type: 'products_grid', label: 'Products',  Icon: ShoppingCart },
  { type: 'scheduler',     label: 'Scheduler', Icon: CalendarDays }, // ⬅️ NEW quick pick
];

const AI_ENABLED_TYPES = new Set<Block['type']>(
  ['text', 'hero', 'testimonial', 'faq', 'services', 'service_areas', 'hours'] as Block['type'][]
);
const isAiType = (t: Block['type']) => AI_ENABLED_TYPES.has(t);

const aiBadgeTitle = (t: Block['type']) => {
  switch (t) {
    case 'hero': return 'AI-enabled: generate hero headline/subheadline/CTA and image';
    case 'testimonial': return 'AI-enabled: generate realistic testimonials';
    case 'faq': return 'AI-enabled: generate FAQs for your industry/services';
    case 'services': return 'AI-enabled: suggest a services list';
    case 'service_areas': return 'AI-enabled: generate nearby service areas';
    case 'hours': return 'Hours of operation';
    default: return 'AI writer tools available in editor (⌘/Ctrl + J)';
  }
};
const aiNote = (t: Block['type']) => {
  switch (t) {
    case 'hero': return 'Suggests headline/subheadline/CTA, can generate a wide hero image.';
    case 'testimonial': return 'Short realistic quotes tailored to your industry/services.';
    case 'faq': return 'Concise Q&A reflecting your offerings.';
    case 'services': return 'Clean list of customer-facing services.';
    case 'service_areas': return 'Nearby cities/areas using your location.';
    default: return 'Built-in AI writing: intros, FAQs, CTAs, rewrite, etc.';
  }
};

function loadCollapsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try { return JSON.parse(localStorage.getItem('collapsedBlockGroups') || '{}'); } catch { return {}; }
}
function saveCollapsed(groups: Record<string, boolean>) {
  try { localStorage.setItem('collapsedBlockGroups', JSON.stringify(groups)); } catch {}
}

type Props = {
  onAdd: (type: Block['type']) => void;
  onClose: () => void;
  onAddAndEdit?: (type: Block['type']) => void;
  onSelect?: (type: Block['type']) => void;
  existingBlocks?: Block[];
  disallowDuplicates?: Block['type'][];
  label?: string;
  triggerElement?: React.ReactNode;
  colorMode?: 'light' | 'dark';
  template: Template;

  inline?: boolean;
  showOnlyQuickPicks?: boolean;
  startCollapsed?: boolean;
};

export default function BlockAdderGrouped({
  onAdd,
  onClose,
  onAddAndEdit,
  onSelect,
  existingBlocks = [],
  disallowDuplicates = ['footer', 'header', 'hours'],
  label = 'Add Block',
  triggerElement,
  colorMode = 'dark',
  template,
  inline = false,
  showOnlyQuickPicks = false,
  startCollapsed = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [showMore, setShowMore] = useState(!showOnlyQuickPicks);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const initialCollapsed = startCollapsed
    ? Object.fromEntries(Object.keys(blockGroups).map((k) => [k, true]))
    : loadCollapsed();

  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(initialCollapsed);

  const close = () => {
    setOpen(false);
    // Notify parent that the modal closed
    try { onClose(); } catch {}
  };

  // ESC key closes (only when modal is open and not inline)
  useEffect(() => {
    if (inline || !open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [inline, open]);

  const blocked = new Set(
    existingBlocks.filter((b) => disallowDuplicates.includes(b.type)).map((b) => b.type)
  );

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    const searchActive = q.length > 0;
    const wantsAi = searchActive && /(^|[^a-z])ai([^a-z]|$)|copy|write|generate/.test(q);

    return Object.entries(blockGroups).map(([key, group]) => {
      const totalCount = group.types.filter((type) => !blocked.has(type)).length;

      const matched = group.types.filter((type) => {
        if (blocked.has(type)) return false;
        if (!searchActive) return true;
        const label = (blockMeta[type as keyof typeof blockMeta]?.label || '').toLowerCase();
        const t = String(type).toLowerCase();
        return label.includes(q) || t.includes(q) || (wantsAi && isAiType(type));
      });

      return {
        key,
        label: group.label,
        types: matched,           // what we render
        totalCount,               // total available (unblocked)
        matchedCount: matched.length,
      };
    });
  }, [search, existingBlocks]);

  const searchActive = search.trim().length > 0;

  // If searching, open “More” automatically so results are visible
  useEffect(() => {
    if (searchActive) setShowMore(true);
  }, [searchActive]);

  const QuickPicks = (
    <div className="p-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_PICKS.map(({ type, label, Icon }) => (
          <button
            key={type}
            onClick={() => {
              (onAddAndEdit ?? onAdd)(type);
              setSearch('');
              if (!inline) close();
            }}
            className="group relative rounded-xl border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 p-4
                       hover:border-purple-500 hover:bg-white dark:hover:bg-neutral-700 transition text-left"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-lg flex items-center justify-center
                              bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700
                              group-hover:border-purple-500">
                <Icon className="h-6 w-6 text-gray-700 dark:text-gray-200" />
              </div>
              <div className="font-medium text-gray-900 dark:text-white">{label}</div>
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Adds a {label.toLowerCase()} block and opens the editor
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const MoreList = (
    <>
      {/* Search field */}
      <div className="px-4 pb-4">
        <input
          autoFocus
          type="text"
          placeholder='Search block types… (try "ai", "product", "service", "schedule")'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-md border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
      </div>

      {/* Scrollable results */}
      <div className="px-4 pb-4">
        <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
          {groups.map(({ key, label, types, totalCount, matchedCount }) => {
            const collapsed = searchActive ? matchedCount === 0 : (collapsedGroups[key] ?? false);
            const displayCount = searchActive ? matchedCount : totalCount;

            return (
              <div key={key}>
                <div
                  role={searchActive ? 'region' : 'button'}
                  tabIndex={searchActive ? -1 : 0}
                  onClick={() => {
                    if (searchActive) return;
                    const next = { ...collapsedGroups, [key]: !collapsedGroups[key] };
                    setCollapsedGroups(next); saveCollapsed(next);
                  }}
                  onKeyDown={(e) => {
                    if (searchActive) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const next = { ...collapsedGroups, [key]: !collapsedGroups[key] };
                      setCollapsedGroups(next); saveCollapsed(next);
                    }
                  }}
                  className={[
                    'w-full text-left px-4 py-2 font-medium text-sm rounded',
                    'bg-gray-50 dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700',
                    searchActive ? 'cursor-default opacity-95' : 'cursor-pointer',
                    'text-gray-700 dark:text-gray-300 flex items-center justify-between'
                  ].join(' ')}
                >
                  <span>{label}</span>
                  <span
                    className="ml-3 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]
                               border-gray-300 text-gray-700 bg-white
                               dark:border-neutral-600 dark:text-gray-200 dark:bg-neutral-900"
                    title={searchActive ? `${matchedCount} match${matchedCount === 1 ? '' : 'es'}` : `${totalCount} total`}
                  >
                    {displayCount}
                  </span>
                </div>

                {!collapsed && (
                  <div className="pt-2 flex flex-col gap-4">
                    {types.length > 0 ? (
                      types.map((type) => {
                        const meta = blockMeta[type as keyof typeof blockMeta];
                        const aiEnabled = isAiType(type);
                        return (
                          <div
                            key={type}
                            role="button"
                            tabIndex={0}
                            onClick={() => { onAdd(type); setSearch(''); if (!inline) close(); }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(type); setSearch(''); if (!inline) close(); }
                            }}
                            className="text-left px-4 py-4 rounded-md border bg-white dark:bg-neutral-900 space-y-3 cursor-pointer
                                       border-gray-300 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800"
                          >
                            <div className="flex items-center gap-2">
                              <div className="text-lg">{meta.icon}</div>
                              <div className="min-w-0">
                                <div className="font-medium text-gray-800 dark:text-white truncate">
                                  {meta.label}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">Block type: {type}</div>
                              </div>
                              {aiEnabled && (
                                <span
                                  title={aiBadgeTitle(type)}
                                  className="ml-auto inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]
                                             bg-purple-100 text-purple-700 border-purple-300
                                             dark:bg-purple-600/15 dark:text-purple-200 dark:border-purple-500/40"
                                >
                                  <Sparkles className="h-3 w-3" />
                                  AI
                                </span>
                              )}
                            </div>

                            {aiEnabled && (
                              <div className="text-xs text-purple-700 dark:text-purple-300">
                                {aiNote(type)}
                              </div>
                            )}

                            <div className="relative w-full border rounded overflow-hidden border-gray-300 dark:border-neutral-700">
                              <RenderBlockMini
                                block={createDefaultBlock(type) as any}
                                className="w-full h-32"
                                showDebug={false}
                                colorMode={colorMode}
                                template={template}
                              />
                              {aiEnabled && (
                                <span className="pointer-events-none absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px] font-medium bg-purple-600 text-white shadow">
                                  ✨ AI
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="px-2 py-1 text-sm text-gray-500 dark:text-gray-400">No matches</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );

  if (inline) {
    return (
      <div>
        {QuickPicks}

        {!showMore ? (
          <div className="px-4 pb-4">
            <button
              className="w-full rounded-md px-3 py-2 text-sm bg-white/10 hover:bg-white/20 text-white"
              onClick={() => setShowMore(true)}
            >
              More block types…
            </button>
          </div>
        ) : null}

        {showMore && MoreList}
      </div>
    );
  }

  // Legacy self-contained trigger + modal mode
  return (
    <>
      <div onClick={() => setOpen(true)}>
        {triggerElement ?? (
          <SafeTriggerButton
            onClick={() => setOpen(true)}
            className="w-full bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 text-center"
          >
            {label}
          </SafeTriggerButton>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onMouseDown={(e) => {
            // Close on backdrop click
            if (e.target === e.currentTarget) close();
          }}
        >
          <div
            ref={modalRef}
            className="bg-white dark:bg-neutral-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-black/10 dark:border-white/10"
            // Prevent backdrop-close when clicking inside
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-neutral-700 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-white">{label}</h2>
              <button
                onClick={close}
                aria-label="Close"
                className="text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto">
              {QuickPicks}

              {!showMore ? (
                <div className="px-4 pb-4">
                  <button
                    className="w-full rounded-md px-3 py-2 text-sm bg-white/10 hover:bg-white/20 text-white"
                    onClick={() => setShowMore(true)}
                  >
                    More block types…
                  </button>
                </div>
              ) : null}

              {showMore && MoreList}
            </div>

            {/* Footer with Cancel button */}
            <div className="p-3 border-t border-gray-200 dark:border-neutral-700 flex justify-end bg-gray-50/60 dark:bg-neutral-900/60">
              <button
                onClick={close}
                className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-700 text-gray-800 dark:text-gray-100"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
