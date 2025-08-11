// components/admin/templates/LiveEditorPreview.tsx
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
import { GripVertical, Pencil, Trash2, PlusCircle, Moon, Sun } from 'lucide-react';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { Template } from '@/types/template';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import SafeTriggerButton from '@/components/ui/safe-trigger-button';
import { saveTemplate } from '@/admin/lib/saveTemplate';
import { TemplateThemeWrapper } from '@/components/theme/template-theme-wrapper';
import { useTheme } from '@/hooks/useThemeContext';

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
// ------------------------------------

function BlockWrapper({ block, children, onEdit, onDelete, showOutlines }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: block._id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded p-2 transition-all ${
        showOutlines ? 'border border-dashed border-purple-700/40' : 'border border-gray-300 dark:border-white/10'
      } bg-white dark:bg-zinc-900`}
    >
      <div className="flex justify-between items-center mb-1 opacity-80 text-xs text-black dark:text-white">
        <div className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-gray-500 cursor-move" {...attributes} {...listeners} />
          <span className="uppercase tracking-wide">{block.type}</span>
        </div>
        <div className="hidden group-hover:flex gap-2">
          <button onClick={onEdit} className="text-xs text-blue-500 underline">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 underline">
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

  if (!selectedPage) {
    return (
      <div className="p-8 text-white text-center">
        <div className="text-lg font-semibold mb-2">No page found</div>
        <p className="text-sm text-white/70">The template has no pages defined yet. Add one to begin editing.</p>
      </div>
    );
  }

  return (
    <TemplateThemeWrapper colorMode={resolvedColorMode}>
      <div className="w-full max-w-none px-0">
        <div className="absolute top-0 right-0 z-10 m-2">
          <button
            onClick={toggleColorMode}
            className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-zinc-800 rounded hover:bg-zinc-700"
          >
            {resolvedColorMode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            {resolvedColorMode === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>

        <div className="relative min-h-screen">
          <div className="px-0 sm:px-2 xl:px-0 pb-20 pt-4 space-y-6 w-full xl:max-w-[90%] xl:mx-auto">
            <div className="flex gap-2 mb-4 text-sm text-black dark:text-white/70">
              {pages.map((p: any, i: number) => (
                <button
                  key={p.id ?? `page-${i}`}
                  onClick={() => setSelectedPageId(p.id)}
                  className={`px-3 py-1 rounded ${
                    i === selectedPageIndex
                      ? 'bg-purple-700 text-white'
                      : 'bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700'
                  }`}
                >
                  {p.title || p.slug || `Page ${i + 1}`}
                </button>
              ))}
            </div>

            {selectedPage?.show_header !== false && (template as any).headerBlock && (
              <RenderBlock
                block={(template as any).headerBlock}
                showDebug={false}
                colorMode={resolvedColorMode}
              />
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
                items={(selectedPage?.content_blocks ?? []).map((b: any) => b._id ?? '')}
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
                      <div id={`block-${block._id}`} data-block-id={block._id}>
                        <RenderBlock
                          block={block}
                          showDebug={false}
                          colorMode={resolvedColorMode}
                        />
                      </div>
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
                          <SafeTriggerButton
                            onClick={() => {
                              const newBlock = createDefaultBlock('text');
                              const updatedPage = {
                                ...selectedPage,
                                content_blocks: [
                                  ...(selectedPage?.content_blocks ?? []).slice(0, blockIndex + 1),
                                  newBlock as any,
                                  ...(selectedPage?.content_blocks ?? []).slice(blockIndex + 1),
                                ],
                              };
                              setLastInsertedId((newBlock as any)._id ?? '');
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
                            className="text-sm text-purple-500 hover:underline mt-2"
                          >
                            + Add Block Below
                          </SafeTriggerButton>
                        }
                      />
                    </BlockWrapper>
                  ))}
                </div>
              </SortableContext>

              <div className="relative z-10 bg-white dark:bg-neutral-900 p-4 border-t border-gray-200 dark:border-neutral-700 mt-6">
                <BlockAdderGrouped
                  onAdd={(type) => {
                    const newBlock = createDefaultBlock(type);
                    const updatedPage = {
                      ...selectedPage,
                      content_blocks: [...(selectedPage?.content_blocks ?? []), newBlock as any],
                    };
                    setLastInsertedId((newBlock as any)._id ?? '');
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
                    <SafeTriggerButton
                      onClick={() => {
                        const newBlock = createDefaultBlock('text');
                        const updatedPage = {
                          ...selectedPage,
                          content_blocks: [...(selectedPage?.content_blocks ?? []), newBlock as any],
                        };
                        setLastInsertedId((newBlock as any)._id ?? '');
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
                      className="w-full flex items-center justify-center gap-2 border border-purple-600 text-purple-600 dark:text-purple-400 rounded px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors"
                    >
                      <PlusCircle className="w-4 h-4" />
                      <span>Add Block to End</span>
                    </SafeTriggerButton>
                  }
                />
              </div>
            </DndContext>

            {selectedPage?.show_footer !== false && (template as any).footerBlock && (
              <RenderBlock
                block={(template as any).footerBlock}
                showDebug={false}
                colorMode={resolvedColorMode}
              />
            )}
          </div>
        </div>

        {editing && (
          <div className="fixed inset-0 bg-black/90 z-[999] p-6 overflow-auto flex items-center justify-center">
            <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
              <DynamicBlockEditor
                block={editing}
                onSave={(updatedBlock) => {
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
                      pages: pages.map((p: any, idx: number) => (idx === selectedPageIndex ? updatedPage : p)),
                    },
                  } as Template);
                  updateAndSave(next);
                  setEditing(null);
                }}
                onClose={() => setEditing(null)}
                errors={errors}
                template={template}
              />
            </div>
          </div>
        )}
      </div>
    </TemplateThemeWrapper>
  );
}
