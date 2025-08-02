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
import { GripVertical, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import { DynamicBlockEditor } from '@/components/editor/dynamic-block-editor';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { Template } from '@/types/template';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import SafeTriggerButton from '@/components/ui/safe-trigger-button';

function BlockWrapper({ block, children, onEdit, onDelete, showOutlines }: any) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: block._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded p-2 ${
        showOutlines
          ? 'border border-dashed border-purple-700/40'
          : 'border border-white/10'
      }`}
    >
      <div className="flex justify-between items-center mb-1 opacity-80 text-xs text-white">
        <div className="flex items-center gap-1">
          <GripVertical
            className="w-3 h-3 text-gray-500 cursor-move"
            {...attributes}
            {...listeners}
          />
          <span className="uppercase tracking-wide">{block.type}</span>
        </div>
        <div className="hidden group-hover:flex gap-2">
          <button onClick={onEdit} className="text-xs text-blue-400 underline">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="text-xs text-red-400 underline">
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
}: {
  template: Template;
  onChange: (template: Template) => void;
  industry: string;
  errors: Record<string, BlockValidationError[]>;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [layoutMode, setLayoutMode] = useState<'stack' | 'grid'>('stack');
  const [editing, setEditing] = useState<any | null>(null);
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);
  const [selectedPageIndex, setSelectedPageIndex] = useState(0); // ✅ now editable
  const [isCentered, setIsCentered] = useState(false);
  const [showOutlines, setShowOutlines] = useState(false);

  // 🧹 Strip template.pages on first load
  useEffect(() => {
    if ('pages' in template) {
      console.warn('🧹 Removing top-level template.pages from runtime state');
      const updated = { ...template };
      delete (updated as any).pages;
      onChange(updated);
    }
  }, []);

  // 🛡 Prevent fallback unless truly no usable pages exist
  useEffect(() => {
    const dataPages = template?.data?.pages;
    const rootPages = (template as any)?.pages;

    const hasValidDataPages =
      Array.isArray(dataPages) &&
      dataPages.length > 0 &&
      dataPages.some((p) => Array.isArray(p?.content_blocks));

    const hasRootPages =
      Array.isArray(rootPages) && rootPages.length > 0;

    if (!hasValidDataPages && !hasRootPages) {
      console.warn('⚠️ Fallback page injected — no usable pages found', {
        dataPages,
        rootPages,
        template,
      });

      const defaultHeroBlock = createDefaultBlock('hero');
      const defaultPage = {
        id: 'home-page',
        slug: 'home',
        title: 'Home',
        show_footer: true,
        show_header: true,
        content_blocks: [defaultHeroBlock],
      };

      const updated = {
        ...template,
        data: {
          ...(template.data || {}),
          pages: [defaultPage],
        },
      };

      onChange(updated);
    }
  }, [template, onChange]);

  const pages =
    template?.data?.pages?.length > 0
      ? template.data.pages
      : (template as any).pages ?? [];

  const selectedPage = pages[selectedPageIndex] ?? null;

  if (!selectedPage) {
    return (
      <div className="p-8 text-white text-center">
        <div className="text-lg font-semibold mb-2">No page found</div>
        <p className="text-sm text-white/70">
          The template has no pages defined yet. Add one to begin editing.
        </p>
      </div>
    );
  }

  const updateAndSave = (updated: Template) => {
    onChange({ ...updated });
  };

  return (
    <div className="w-full max-w-none px-0">
      <div className="relative dark:bg-neutral-900 text-white min-h-screen">
        <div className="px-0 sm:px-2 xl:px-0 pb-20 pt-4 space-y-6 w-full xl:max-w-[90%] xl:mx-auto">
          {/* Page switcher (basic dev version) */}
          <div className="flex gap-2 mb-4 text-sm text-white/70">
            {pages.map((p: any, i: number) => (
              <button
                key={p.id}
                onClick={() => setSelectedPageIndex(i)}
                className={`px-3 py-1 rounded ${
                  i === selectedPageIndex
                    ? 'bg-purple-700 text-white'
                    : 'bg-zinc-800 hover:bg-zinc-700'
                }`}
              >
                {p.title || p.slug || `Page ${i + 1}`}
              </button>
            ))}
          </div>

          {selectedPage?.show_header !== false && template.headerBlock && (
            <RenderBlock block={template.headerBlock} />
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
              const updated = { ...template };
              updated.data.pages[selectedPageIndex].content_blocks = reordered;
              updateAndSave(updated);
            }}
          >
            <SortableContext
              items={(selectedPage?.content_blocks ?? []).map((b: any) => b._id ?? '')}
              strategy={verticalListSortingStrategy}
            >
              <div
                className={
                  layoutMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 gap-4'
                    : 'space-y-6'
                }
              >
              {(selectedPage?.content_blocks ?? []).map((block: any, blockIndex: number) => (
                <BlockWrapper
                  key={block._id || `block-${blockIndex}`}
                  block={block}
                  showOutlines={showOutlines}
                  onEdit={() => setEditing(block)}
                  onDelete={() => {
                    const updated = { ...template };
                    updated.data.pages[selectedPageIndex].content_blocks.splice(blockIndex, 1);
                    updateAndSave(updated);
                  }}
                >
                    <div id={`block-${block._id}`} data-block-id={block._id}>
                      <RenderBlock block={block} />
                    </div>
                    <BlockAdderGrouped
                      onAdd={(type) => {
                        const newBlock = createDefaultBlock(type);
                        const updated = { ...template };
                        updated.data.pages[selectedPageIndex].content_blocks.splice(
                          blockIndex + 1,
                          0,
                          newBlock
                        );
                        setLastInsertedId(newBlock._id ?? '');
                        updateAndSave(updated);
                      }}
                      existingBlocks={selectedPage.content_blocks}
                      triggerElement={
                        <SafeTriggerButton
                          onClick={() => {
                            const newBlock = createDefaultBlock('text');
                            const updated = { ...template };
                            updated.data.pages[selectedPageIndex].content_blocks.splice(
                              blockIndex + 1,
                              0,
                              newBlock
                            );
                            setLastInsertedId(newBlock._id ?? '');
                            updateAndSave(updated);
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
                  const updated = { ...template };
                  updated.data.pages[selectedPageIndex].content_blocks.push(newBlock);
                  setLastInsertedId(newBlock._id ?? '');
                  updateAndSave(updated);
                }}
                existingBlocks={selectedPage.content_blocks}
                triggerElement={
                  <SafeTriggerButton
                    onClick={() => {
                      const newBlock = createDefaultBlock('text');
                      const updated = { ...template };
                      updated.data.pages[selectedPageIndex].content_blocks.push(newBlock);
                      setLastInsertedId(newBlock._id ?? '');
                      updateAndSave(updated);
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
            <RenderBlock block={template.footerBlock} />
          )}
        </div>
      </div>
      {editing && (
  <div className="fixed inset-0 bg-black/90 z-[999] p-6 overflow-auto flex items-center justify-center">
    <div className="w-full max-w-4xl bg-neutral-900 border border-white/10 rounded-xl shadow-xl overflow-hidden">
      <DynamicBlockEditor
        block={editing}
        onSave={(updatedBlock) => {
          const updated = { ...template };
          for (const page of updated.data.pages) {
            const index = page.content_blocks.findIndex(
              (b) => b._id === updatedBlock._id
            );
            if (index !== -1) {
              page.content_blocks[index] = updatedBlock;
              break;
            }
          }
          updateAndSave(updated);
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
  );
}
