// components/editor/live-editor-preview.tsx
'use client';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, useEffect } from 'react';
import { GripVertical, Pencil, Trash2, PlusCircle, Moon, Sun, X } from 'lucide-react';

import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import type { Template } from '@/types/template';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import SafeTriggerButton from '@/components/ui/safe-trigger-button';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import { TemplateThemeWrapper } from '@/components/theme/template-theme-wrapper';
import { useTheme } from '@/hooks/useThemeContext';
import GlobalChromeEditors from '@/components/admin/templates/global-chrome-editors';
import PageTabsBar from '@/components/admin/templates/page-tabs-bar';
import type { Page } from '@/types/template';

// ---------- helpers (pure) ----------
function getPages(tpl: any) {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}

function withSyncedPages(tpl: Template): Template {
  const pages = getPages(tpl);
  return {
    ...tpl,
    pages, // legacy readers
    data: { ...(tpl.data ?? {}), pages }, // canonical
  } as Template;
}

function getEffectiveHeader(page: any, template: any) {
  if (page?.show_header === false) return null;
  return page?.headerOverride ?? template?.headerBlock ?? null;
}
function getEffectiveFooter(page: any, template: any) {
  if (page?.show_footer === false) return null;
  return page?.footerOverride ?? template?.footerBlock ?? null;
}
// ------------------------------------

// --- Block wrapper: no chrome at rest; bg + ring on hover ---
function BlockWrapper({
  block,
  children,
  onEdit,
  onDelete,
  showOutlines,
}: {
  block: any;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  showOutlines: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block._id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const frameClasses = showOutlines
    ? 'border border-dashed border-purple-700/40'
    : [
        // no chrome at rest
        'border-0 ring-0 bg-transparent dark:bg-transparent',
        // only show on hover
        'group-hover/blk:ring-1 group-hover/blk:ring-gray-300 dark:group-hover/blk:ring-white/10',
        'group-hover/blk:bg-white dark:group-hover/blk:bg-zinc-900',
      ].join(' ');

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'group/blk relative rounded p-2 transition-colors',
        frameClasses,
      ].join(' ')}
    >
      {/* top chrome (hidden until hover) */}
      <div
        className="flex justify-between items-center mb-1 text-xs text-black dark:text-white
                   opacity-0 group-hover/blk:opacity-100 transition-opacity"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-1">
          <GripVertical
            className="w-3 h-3 text-gray-500 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
            // title="Drag to reorder"
            aria-label="Drag handle"
          />
          <span className="uppercase tracking-wide">{block.type}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-xs text-blue-500 underline" title="Edit block">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 underline" title="Delete block">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}

export function LiveEditorPreview({
  template,
  onChange,
  industry,
  errors,
  templateId,
}: {
  template: Template;
  onChange: (template: Template) => void;
  industry: string;
  errors: Record<string, BlockValidationError[]>;
  templateId: string;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [layoutMode] = useState<'stack' | 'grid'>('stack');
  const [editing, setEditing] = useState<any | null>(null);
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);
  const [showOutlines, setShowOutlines] = useState(false);

  // Theme context + a single resolved color mode for the whole UI
  const { theme: ctxTheme, setTheme } = useTheme();
  const resolvedColorMode =
    ((template as any).color_mode as 'light' | 'dark' | undefined) ??
    (ctxTheme?.darkMode as 'light' | 'dark' | undefined) ??
    'light';

  // --- Immersive / Fullscreen state & helpers ---
  const [isImmersive, setIsImmersive] = useState(false);

  function scrollToFirstBlockTop() {
    const el =
      document.getElementById(`block-${pages?.[selectedPageIndex]?.content_blocks?.[0]?._id}`) ??
      document.querySelector<HTMLElement>('[data-block-id]');
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const current = window.pageYOffset || document.documentElement.scrollTop || 0;
    const top = current + rect.top - 24;
    window.scrollTo({ top, behavior: 'smooth' });
  }

  async function enterImmersive() {
    try {
      const el: any = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen({ navigationUI: 'hide' } as any);
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
      setIsImmersive(true);
      setTimeout(scrollToFirstBlockTop, 10);
    } catch {
      // If fullscreen rejected, still engage "immersive" UX
      setIsImmersive(true);
      setTimeout(scrollToFirstBlockTop, 10);
    }
  }

  async function exitImmersive() {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen?.();
      } else if ((document as any).webkitFullscreenElement) {
        (document as any).webkitExitFullscreen?.();
      }
    } finally {
      setIsImmersive(false);
    }
  }

  // Keep <html> class in sync
  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedColorMode === 'dark');
  }, [resolvedColorMode]);

  // Keep context in sync with the template when template.color_mode changes (e.g., after a save/refresh)
  useEffect(() => {
    const tMode = (template as any).color_mode as 'light' | 'dark' | undefined;
    if (tMode && ctxTheme?.darkMode !== tMode) {
      setTheme({ ...(ctxTheme || {}), darkMode: tMode } as any);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(template as any).color_mode]);

  // Sync immersive state if user exits fullscreen via browser controls
  useEffect(() => {
    const sync = () => {
      const active =
        !!document.fullscreenElement || !!(document as any).webkitFullscreenElement;
      setIsImmersive(active);
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync as any);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync as any);
    };
  }, []);

  // Hotkeys: f to toggle immersive, Esc to exit (ignored while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isTyping =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag || '') ||
        (e.target as HTMLElement)?.isContentEditable;

      if (isTyping) return;

      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key.toLowerCase() === 'f') {
          e.preventDefault();
          isImmersive ? exitImmersive() : enterImmersive();
        }
        if (e.key === 'Escape' && isImmersive) {
          e.preventDefault();
          exitImmersive();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isImmersive, templateId]);

  const setPageChrome = async (
    key: 'show_header' | 'show_footer',
    value: boolean
  ) => {
    if (!selectedPage) return;
    const updatedPage = { ...selectedPage, [key]: value };

    const next = withSyncedPages({
      ...template,
      color_mode: resolvedColorMode,
      data: {
        ...(template.data ?? {}),
        pages: pages.map((p: any, idx: number) =>
          idx === selectedPageIndex ? updatedPage : p
        ),
      },
    } as Template);

    await updateAndSave(next);
  };

  // ---------- PAGE SELECTION BY ID (persists across saves/remounts) ----------
  const pages = getPages(template);
  const STORAGE_KEY = `qs:selectedPageId:${templateId}`;

  const [selectedPageId, setSelectedPageId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) return saved;
    }
    return pages?.[0]?.id ?? null;
  });

  useEffect(() => {
    if (selectedPageId && typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, selectedPageId);
    }
  }, [selectedPageId, STORAGE_KEY]);

  useEffect(() => {
    if (!pages?.length) return;
    if (!selectedPageId || !pages.some((p: any) => p.id === selectedPageId)) {
      setSelectedPageId(pages[0]?.id ?? null);
    }
  }, [pages, selectedPageId]);

  const selectedPageIndex = Math.max(0, pages.findIndex((p: any) => p.id === selectedPageId));
  const selectedPage = pages[selectedPageIndex] ?? null;
  const hasBlocks = (selectedPage?.content_blocks?.length ?? 0) > 0;

  // Always save with pages synced AND the current color mode preserved
  const updateAndSave = async (updatedRaw: Template) => {
    const ensuredColor = ((updatedRaw as any).color_mode as 'light' | 'dark' | undefined) ?? resolvedColorMode;
    const ensured: Template = { ...updatedRaw, color_mode: ensuredColor } as any;

    const updated = withSyncedPages(ensured);
    onChange({ ...updated });
    try {
      const validId = updated.id && updated.id.trim() !== '' ? updated.id : undefined;
      if (!validId) throw new Error('Missing template ID');
      await saveTemplate(updated, validId);
    } catch (err) {
      console.error('❌ Failed to save template update', err);
    }
  };

  const toggleColorMode = async () => {
    const next = resolvedColorMode === 'dark' ? 'light' : 'dark';

    // Optimistic context update to keep side panel aligned
    setTheme({ ...(ctxTheme || {}), darkMode: next } as any);

    // Persist on the template and keep current page selected
    const keepId = selectedPageId;
    await updateAndSave({ ...template, color_mode: next as 'light' | 'dark' });
    if (keepId) setSelectedPageId(keepId);
  };

  // Auto-scroll newly inserted blocks into view
  useEffect(() => {
    if (!lastInsertedId) return;
    const el = document.querySelector<HTMLElement>(`[data-block-id="${lastInsertedId}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [lastInsertedId]);

  if (!selectedPage) {
    return (
      <div className="p-8 text-white text-center">
        <div className="text-lg font-semibold mb-2">No page found</div>
        <p className="text-sm text-white/70">The template has no pages defined yet. Add one to begin editing.</p>
      </div>
    );
  }

  // Resolve effective header/footer based on page toggles + overrides
  const effectiveHeader = getEffectiveHeader(selectedPage, template);
  const effectiveFooter = getEffectiveFooter(selectedPage, template);
  const slugify = (s: string) =>
    s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  
  return (
    <TemplateThemeWrapper
      template={template}
      mode="template"
      renderHeader={false}
      renderFooter={false}
    >
      {/* Exit immersive button */}
      {isImmersive && (
        <button
          onClick={exitImmersive}
          aria-label="Exit full screen"
          title="Exit full screen (Esc)"
          className="fixed top-3 left-3 z-[1000] rounded-full p-2
                     bg-black/60 border border-purple-500/60
                     shadow-[0_0_0_2px_rgba(168,85,247,.35),0_0_18px_2px_rgba(168,85,247,.35)]
                     hover:bg-black/70 transition"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      )}

      <div className="w-full max-w-none px-0">
          <button
            onClick={toggleColorMode}
            className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-purple-400"
            aria-label="Toggle color mode"
            title="Toggle color mode"
          >
            {resolvedColorMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            {resolvedColorMode === 'dark' ? 'Dark' : 'Light'}
          </button>

        <div className="relative min-h-screen">
          <div className="px-0 sm:px-2 xl:px-0 pb-20 pt-4 space-y-6 w-full xl:max-w-[90%] xl:mx-auto">
            {/* <GlobalChromeEditors
              template={template}
              onChange={onChange}
              onSaveTemplate={updateAndSave}
            /> */}

            {/* Per-page chrome visibility */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-xs uppercase tracking-wide text-black/60 dark:text-white/60">
                Page Settings:
              </span>

              {/* Header toggle */}
              <button
                type="button"
                onClick={() => setPageChrome('show_header', !(selectedPage?.show_header !== false))}
                className={`px-2 py-1 text-xs rounded border transition
                  ${selectedPage?.show_header !== false
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'}`}
                title="Show or hide the global header on this page"
              >
                Header: {selectedPage?.show_header !== false ? 'Visible' : 'Hidden'}
              </button>

              {/* Footer toggle */}
              <button
                type="button"
                onClick={() => setPageChrome('show_footer', !(selectedPage?.show_footer !== false))}
                className={`px-2 py-1 text-xs rounded border transition
                  ${selectedPage?.show_footer !== false
                    ? 'bg-emerald-600/20 text-emerald-300 border-emerald-600/40 hover:bg-emerald-600/30'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-600 hover:bg-zinc-700'}`}
                title="Show or hide the global footer on this page"
              >
                Footer: {selectedPage?.show_footer !== false ? 'Visible' : 'Hidden'}
              </button>
            </div>

            <PageTabsBar
              pages={pages}
              selectedIndex={selectedPageIndex}
              template={template}
              onSelect={(i) => setSelectedPageId(pages[i]?.id ?? null)}
              onAdd={(newPage) => {
                const ensured: Page = { ...newPage, id: newPage.id || crypto.randomUUID() };
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: [...pages, ensured] },
                  color_mode: resolvedColorMode,
                } as Template);
                updateAndSave(next);
                setSelectedPageId(ensured.id);
              }}
              onRename={(index, title, incomingSlug) => {
                // Base slug from incoming or title
                let nextSlug = (incomingSlug && incomingSlug.trim()) || slugify(title);
              
                // ensure uniqueness
                const others = new Set(pages.map((p, i) => (i === index ? '' : p.slug)));
                const base = nextSlug.replace(/-\d+$/, '');
                let n = 2;
                while (others.has(nextSlug)) nextSlug = `${base}-${n++}`;
              
                const updated = pages.map((p, i) =>
                  i === index ? { ...p, title, slug: nextSlug } : p
                );
              
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: updated },
                  color_mode: resolvedColorMode,
                } as Template);
              
                updateAndSave(next);
              
                // if the renamed page was selected, keep selection by id
                setSelectedPageId(updated[index]?.id ?? null);
              }}
              
              onDelete={(index) => {
                // no confirm here — PageTabsBar handles prompting
                if (pages.length <= 1) {
                  alert('You must keep at least one page.');
                  return;
                }
              
                const updated = pages.filter((_, i) => i !== index);
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: updated },
                  color_mode: resolvedColorMode,
                } as Template);
                updateAndSave(next);
              
                const newIdx = Math.min(updated.length - 1, Math.max(0, index - 1));
                setSelectedPageId(updated[newIdx]?.id ?? null);
              }}
              onReorder={(oldIndex, newIndex) => {
                if (oldIndex === newIndex) return;
                const copy = [...pages];
                const [moved] = copy.splice(oldIndex, 1);
                copy.splice(newIndex, 0, moved);
                const next = withSyncedPages({
                  ...template,
                  data: { ...(template.data ?? {}), pages: copy },
                  color_mode: resolvedColorMode,
                } as Template);
                updateAndSave(next);
                // keep the same page selected after reorder
                setSelectedPageId(moved.id);
              }}
            />

            {effectiveHeader && (
              <RenderBlock block={effectiveHeader} showDebug={false} colorMode={resolvedColorMode} />
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const blocks = [...(selectedPage?.content_blocks ?? [])];
                const oldIndex = blocks.findIndex((b: any) => b._id === active.id);
                const newIndex = blocks.findIndex((b: any) => b._id === over.id);
                if (oldIndex < 0 || newIndex < 0) return;
                const reordered = arrayMove(blocks, oldIndex, newIndex);
                const updated = withSyncedPages({
                  ...template,
                  color_mode: resolvedColorMode, // ensure we don’t drop it
                  data: {
                    ...(template.data ?? {}),
                    pages: pages.map((p: any, idx: number) =>
                      idx === selectedPageIndex ? { ...p, content_blocks: reordered } : p
                    ),
                  },
                } as Template);
                updateAndSave(updated);
              }}
            >
              <SortableContext
                items={(selectedPage?.content_blocks ?? []).map(
                  (b: any, i: number) => b?._id ?? `idx-${i}`
                )}
                strategy={verticalListSortingStrategy}
              >
                <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-6'}>
                {(selectedPage?.content_blocks ?? []).map((block: any, blockIndex: number) => (
                  <BlockWrapper
                    key={block._id || `block-${blockIndex}`}
                    block={block}
                    showOutlines={showOutlines}
                    onEdit={() => setEditing(block)}
                    onDelete={() => {
                      const updatedPage = {
                        ...selectedPage,
                        content_blocks: (selectedPage?.content_blocks ?? []).filter((_: any, i: number) => i !== blockIndex),
                      };
                      const next = withSyncedPages({
                        ...template,
                        color_mode: resolvedColorMode,
                        data: {
                          ...(template.data ?? {}),
                          pages: pages.map((p: any, idx: number) => (idx === selectedPageIndex ? updatedPage : p)),
                        },
                      } as Template);
                      updateAndSave(next);
                    }}
                  >
                    {/* Add Above — hidden until hover */}
                    <BlockAdderGrouped
                      onAdd={(type) => {
                        const newBlock = createDefaultBlock(type);
                        const updatedPage = {
                          ...selectedPage,
                          content_blocks: [
                            ...(selectedPage?.content_blocks ?? []).slice(0, blockIndex),
                            newBlock as any,
                            ...(selectedPage?.content_blocks ?? []).slice(blockIndex),
                          ],
                        };
                        setLastInsertedId((newBlock as any)._id ?? '');
                        setEditing(newBlock as any); 
                        const next = withSyncedPages({
                          ...template,
                          color_mode: resolvedColorMode,
                          data: {
                            ...(template.data ?? {}),
                            pages: pages.map((p: any, idx: number) => (idx === selectedPageIndex ? updatedPage : p)),
                          },
                        } as Template);
                        updateAndSave(next);
                      }}
                      existingBlocks={selectedPage.content_blocks}
                      triggerElement={
                        <div className="opacity-0 group-hover/blk:opacity-100 transition-opacity pointer-events-none group-hover/blk:pointer-events-auto mb-2">
                          <SafeTriggerButton onClick={() => {}} className="text-sm text-purple-500 hover:underline">
                            + Add Block Above
                          </SafeTriggerButton>
                        </div>
                      }
                    />

                    {/* Block content */}
                    <div id={`block-${block._id}`} data-block-id={block._id}>
                      <RenderBlock block={block} showDebug={false} colorMode={resolvedColorMode} />
                    </div>

                    {/* Add Below — hidden until hover */}
                    <BlockAdderGrouped
                      onAdd={(type) => {
                        const newBlock = createDefaultBlock(type);
                        const updatedPage = {
                          ...selectedPage,
                          content_blocks: [
                            ...(selectedPage?.content_blocks ?? []).slice(0, blockIndex + 1),
                            newBlock as any,
                            ...(selectedPage?.content_blocks ?? []).slice(blockIndex + 1),
                          ],
                        };
                        setLastInsertedId((newBlock as any)._id ?? '');
                        setEditing(newBlock as any);
                        const next = withSyncedPages({
                          ...template,
                          color_mode: resolvedColorMode,
                          data: {
                            ...(template.data ?? {}),
                            pages: pages.map((p: any, idx: number) => (idx === selectedPageIndex ? updatedPage : p)),
                          },
                        } as Template);
                        updateAndSave(next);
                      }}
                      existingBlocks={selectedPage.content_blocks}
                      triggerElement={
                        <div className="opacity-0 group-hover/blk:opacity-100 transition-opacity pointer-events-none group-hover/blk:pointer-events-auto mt-2">
                          <SafeTriggerButton onClick={() => {}} className="text-sm text-purple-500 hover:underline">
                            + Add Block Below
                          </SafeTriggerButton>
                        </div>
                      }
                    />
                  </BlockWrapper>
                ))}
                </div>
              </SortableContext>

              {!hasBlocks && (
              <div className="relative z-10 bg-white dark:bg-neutral-900 p-4 border-t border-gray-200 dark:border-neutral-700 mt-6">
                <BlockAdderGrouped
                  onAdd={(type) => {
                    const newBlock = createDefaultBlock(type);
                    const updatedPage = {
                      ...selectedPage,
                      content_blocks: [...(selectedPage?.content_blocks ?? []), newBlock as any],
                    };
                    setLastInsertedId((newBlock as any)._id ?? '');
                    setEditing(newBlock as any);
                    const next = withSyncedPages({
                      ...template,
                      color_mode: resolvedColorMode,
                      data: {
                        ...(template.data ?? {}),
                        pages: pages.map((p: any, idx: number) =>
                          idx === selectedPageIndex ? updatedPage : p
                        ),
                      },
                    } as Template);
                    updateAndSave(next);
                  }}
                  existingBlocks={selectedPage.content_blocks}
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
              )}
            </DndContext>

            {effectiveFooter && (
              <RenderBlock block={effectiveFooter} showDebug={false} colorMode={resolvedColorMode} />
            )}
          </div>
        </div>

        {editing && (
          <div className="fixed inset-0 bg-black/90 z-[999] p-6 overflow-auto flex items-center justify-center">
            <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
              <DynamicBlockEditor
                block={editing}
                onSave={(updatedBlock: any) => {
                  const updatedPage = {
                    ...selectedPage,
                    content_blocks: (selectedPage?.content_blocks ?? []).map((b: any) =>
                      b._id === updatedBlock._id ? updatedBlock : b
                    ),
                  };
                  const next = withSyncedPages({
                    ...template,
                    color_mode: resolvedColorMode,
                    data: {
                      ...(template.data ?? {}),
                      pages: pages.map((p: any, idx: number) =>
                        idx === selectedPageIndex ? updatedPage : p
                      ),
                    },
                  } as Template);
                  updateAndSave(next);
                  setEditing(null);
                }}
                onClose={() => setEditing(null)}
                errors={errors}
                template={template}
                colorMode={resolvedColorMode}
              />
            </div>
          </div>
        )}
      </div>
    </TemplateThemeWrapper>
  );
}
