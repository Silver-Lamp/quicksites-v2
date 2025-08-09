// LiveEditorPreview.tsx
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
import { useState, useEffect, useRef } from 'react';
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

// ---------- helpers (pure) ----------
function getPages(tpl: any) {
  const dataPages = tpl?.data?.pages;
  const rootPages = tpl?.pages;
  if (Array.isArray(dataPages)) return dataPages;
  if (Array.isArray(rootPages)) return rootPages;
  return [];
}

function resolvePages(next: Partial<Template>, prev: Template) {
  const nextDataPages = (next as any)?.data?.pages;
  const nextRootPages = (next as any)?.pages;
  const prevPages =
    (prev as any)?.data?.pages ??
    (prev as any)?.pages ??
    [];
  return Array.isArray(nextDataPages)
    ? nextDataPages
    : Array.isArray(nextRootPages)
    ? nextRootPages
    : prevPages;
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
  const [layoutMode, setLayoutMode] = useState<'stack' | 'grid'>('stack');
  const [editing, setEditing] = useState<any | null>(null);
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);
  const [isCentered, setIsCentered] = useState(false);
  const [showOutlines, setShowOutlines] = useState(false);

  console.log('[Preview] incoming pages',
    { top: (template as any)?.pages?.length, data: template?.data?.pages?.length }
  );
  
  const pages = getPages(template);
  // ❌ DO NOT mutate or strip template.pages here
  // That was the root cause of "pages disappear"

  useEffect(() => {
    if (template.color_mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [template.color_mode]);

  // ❗ ensure selected index is valid
  useEffect(() => {
    if (selectedPageIndex >= pages.length) setSelectedPageIndex(0);
  }, [pages.length, selectedPageIndex]);

  // ✅ Fallback: guarded for hydration + one-shot
  const attemptedFallbackRef = useRef(false);

  // Inject a fallback page ONLY if neither data.pages nor root pages exist.
  // Keep it mirrored in both places and do not remove root pages.
  // useEffect(() => {
  //   if (attemptedFallbackRef.current) return;

  //   const dataPages = template?.data?.pages;
  //   const rootPages = (template as any)?.pages;

  //   const dataDefined = Array.isArray(dataPages);
  //   const rootDefined = Array.isArray(rootPages);

  //   // Not hydrated yet → do nothing
  //   if (!dataDefined && !rootDefined) return;

  //   // If we have any pages, do nothing
  //   if ((dataDefined && dataPages!.length) || (rootDefined && rootPages!.length)) return;

  //   attemptedFallbackRef.current = true;

  //   // Inject a single default page, mirrored in both places
  //   const defaultHeroBlock = createDefaultBlock('hero');
  //   const defaultPage = {
  //     id: 'home-page',
  //     slug: 'home',
  //     title: 'Home',
  //     show_footer: true,
  //     show_header: true,
  //     content_blocks: [defaultHeroBlock],
  //   };

  //   onChange({
  //     ...template,
  //     pages: [defaultPage] as any,
  //     data: { ...(template.data || {}), pages: [defaultPage] },
  //   } as any);
  // }, [template, onChange]);

  // const pages = getPages(template);
  useEffect(() => {
    if (selectedPageIndex >= pages.length) setSelectedPageIndex(0);
  }, [pages.length, selectedPageIndex]);

  const selectedPage = pages[selectedPageIndex] ?? null;

  // Always save a synced shape
  const updateAndSave = async (updatedRaw: Template) => {
    const updated = withSyncedPages(updatedRaw);
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
    const mode = template.color_mode === 'dark' ? 'light' : 'dark';
    await updateAndSave({ ...template, color_mode: mode as 'light' | 'dark' });
  };

  if (!selectedPage) {
    return (
      <div className="p-8 text-white text-center">
        <div className="text-lg font-semibold mb-2">No page found</div>
        <p className="text-sm text-white/70">The template has no pages defined yet. Add one to begin editing.</p>
      </div>
    );
  }

  console.log(template.pages, template.data?.pages)
  return (
    <TemplateThemeWrapper colorMode={template.color_mode as 'light' | 'dark'}>
      <div className="w-full max-w-none px-0">
        <div className="absolute top-0 right-0 z-10 m-2">
          <button
            onClick={toggleColorMode}
            className="flex items-center gap-1 px-3 py-1 text-sm text-white bg-zinc-800 rounded hover:bg-zinc-700"
          >
            {template.color_mode === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            {template.color_mode === 'dark' ? 'Dark' : 'Light'}
          </button>
        </div>

        <div className="relative min-h-screen">
          <div className="px-0 sm:px-2 xl:px-0 pb-20 pt-4 space-y-6 w-full xl:max-w-[90%] xl:mx-auto">
            <div className="flex gap-2 mb-4 text-sm text-black dark:text-white/70">
              {pages.map((p: any, i: number) => (
                <button
                  key={p.id ?? `page-${i}`}
                  onClick={() => setSelectedPageIndex(i)}
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

            {selectedPage?.show_header !== false && template.headerBlock && (
              <RenderBlock block={template.headerBlock} showDebug={false} colorMode={template.color_mode as 'light' | 'dark'} />
            )}

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const blocks = [...(selectedPage?.content_blocks ?? [])];
                const oldIndex = blocks.findIndex((b) => b._id === active.id);
                const newIndex = blocks.findIndex((b) => b._id === over.id);
                const reordered = arrayMove(blocks, oldIndex, newIndex);
                const updated = withSyncedPages({
                  ...template,
                  data: {
                    ...(template.data ?? {}),
                    pages: pages.map((p, idx) =>
                      idx === selectedPageIndex ? { ...p, content_blocks: reordered } : p
                    ),
                  },
                } as Template);
                updateAndSave(updated);
              }}
            >
              <SortableContext items={(selectedPage?.content_blocks ?? []).map((b: any) => b._id ?? '')} strategy={verticalListSortingStrategy}>
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
                          data: {
                            ...(template.data ?? {}),
                            pages: pages.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p)),
                          },
                        } as Template);
                        updateAndSave(next);
                      }}
                    >
                      <div id={`block-${block._id}`} data-block-id={block._id}>
                        <RenderBlock block={block} showDebug={false} colorMode={template.color_mode as 'light' | 'dark'} />
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
                          setLastInsertedId(newBlock._id ?? '');
                          const next = withSyncedPages({
                            ...template,
                            data: {
                              ...(template.data ?? {}),
                              pages: pages.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p)),
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
                              setLastInsertedId(newBlock._id ?? '');
                              const next = withSyncedPages({
                                ...template,
                                data: {
                                  ...(template.data ?? {}),
                                  pages: pages.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p)),
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
                    setLastInsertedId(newBlock._id ?? '');
                    const next = withSyncedPages({
                      ...template,
                      data: {
                        ...(template.data ?? {}),
                        pages: pages.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p)),
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
                        setLastInsertedId(newBlock._id ?? '');
                        const next = withSyncedPages({
                          ...template,
                          data: {
                            ...(template.data ?? {}),
                            pages: pages.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p)),
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

            {selectedPage?.show_footer !== false && template.footerBlock && (
              <RenderBlock block={template.footerBlock} showDebug={false} colorMode={template.color_mode as 'light' | 'dark'} />
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
                    data: {
                      ...(template.data ?? {}),
                      pages: pages.map((p, idx) => (idx === selectedPageIndex ? updatedPage : p)),
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
