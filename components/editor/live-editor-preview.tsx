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
import { useEffect, useRef, useState } from 'react';
import { GripVertical, Pencil, Trash2, PlusCircle, File } from 'lucide-react';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import { DynamicBlockEditor } from './dynamic-block-editor';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { useClickAway } from 'react-use';
import { Template } from '@/types/template';
import { BlockValidationError } from '@/hooks/validateTemplateBlocks';
import { PageManagerSidebar } from './page-manager-sidebar';

function BlockWrapper({ block, children, onEdit, onDelete }: any) {
  return (
    <div className="group relative border border-white/10 rounded p-2">
      <div className="flex justify-between items-center mb-1 opacity-80 text-xs text-white">
        <div className="flex items-center gap-1">
          <GripVertical className="w-3 h-3 text-gray-500 cursor-move" />
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
  const [selectedPageIndex, setSelectedPageIndex] = useState(0);

  const updateAndSave = (updated: Template) => {
    onChange({ ...updated });
  };

  const selectedPage = template.data.pages[selectedPageIndex];

  const handleAddPage = () => {
    const updated = { ...template };
    updated.data.pages.push({
      id: crypto.randomUUID(),
      slug: `page-${Date.now()}`,
      title: `Untitled Page ${updated.data.pages.length + 1}`,
      content_blocks: [],
    });
    setSelectedPageIndex(updated.data.pages.length - 1);
    updateAndSave(updated);
  };

  const handleRenamePage = (index: number, newTitle: string) => {
    const updated = { ...template };
    updated.data.pages[index].title = newTitle;
    updateAndSave(updated);
  };

  const handleDeletePage = (index: number) => {
    const updated = { ...template };
    updated.data.pages.splice(index, 1);
    setSelectedPageIndex(Math.max(0, index - 1));
    updateAndSave(updated);
  };

  const handleReorderPage = (oldIndex: number, newIndex: number) => {
    const updated = { ...template };
    updated.data.pages = arrayMove(updated.data.pages, oldIndex, newIndex);
    updateAndSave(updated);
  };

  return (
    <div className="flex h-screen overflow-hidden dark:bg-neutral-900 text-white">
      <div className="w-64 bg-neutral-900 border-r border-neutral-800 overflow-y-auto h-screen fixed left-0 top-0 z-40">
        <PageManagerSidebar
          pages={template.data.pages}
          selectedIndex={selectedPageIndex}
          onSelect={setSelectedPageIndex}
          onAdd={handleAddPage}
          onRename={handleRenamePage}
          onDelete={handleDeletePage}
          onReorder={handleReorderPage}
        />
      </div>

      <div className="flex-1 overflow-y-auto h-screen ml-64">
        <div className="p-6 space-y-6 max-w-screen-md mx-auto">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold text-white">{template.template_name}</h1>
            <div className="text-right text-sm space-x-2">
              <button
                onClick={() => setLayoutMode((m) => (m === 'stack' ? 'grid' : 'stack'))}
                className="text-blue-400 underline"
              >
                View: {layoutMode === 'stack' ? 'Vertical' : 'Grid'}
              </button>
            </div>
          </div>

          {selectedPage ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={({ active, over }) => {
                if (!over || active.id === over.id) return;
                const blocks = [...selectedPage.content_blocks];
                const oldIndex = blocks.findIndex((b) => b._id === active.id);
                const newIndex = blocks.findIndex((b) => b._id === over.id);
                const reordered = arrayMove(blocks, oldIndex, newIndex);
                const updated = { ...template };
                updated.data.pages[selectedPageIndex].content_blocks = reordered;
                updateAndSave(updated);
              }}
            >
              <SortableContext
                items={selectedPage.content_blocks.map((b) => b._id ?? '')}
                strategy={verticalListSortingStrategy}
              >
                <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-6'}>
                  {selectedPage.content_blocks.map((block, blockIndex) => (
                    <BlockWrapper
                      key={block._id}
                      block={block}
                      onEdit={() => setEditing(block)}
                      onDelete={() => {
                        const updated = { ...template };
                        updated.data.pages[selectedPageIndex].content_blocks.splice(blockIndex, 1);
                        updateAndSave(updated);
                      }}
                    >
                      <RenderBlock block={block} />
                      <BlockAdderGrouped
                        onAdd={(type) => {
                          const newBlock = createDefaultBlock(type);
                          const updated = { ...template };
                          updated.data.pages[selectedPageIndex].content_blocks.splice(blockIndex + 1, 0, newBlock);
                          setLastInsertedId(newBlock._id ?? '');
                          updateAndSave(updated);
                        }}
                        existingBlocks={selectedPage.content_blocks}
                        triggerElement={
                          <button className="text-sm text-purple-500 hover:underline mt-2">
                            + Add Block Below
                          </button>
                        }
                      />
                    </BlockWrapper>
                  ))}
                </div>
              </SortableContext>

              <div className="sticky bottom-0 z-40 bg-white dark:bg-neutral-900 p-4 border-t border-gray-200 dark:border-neutral-700 mt-6">
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
                    <button className="w-full flex items-center justify-center gap-2 border border-purple-600 text-purple-600 dark:text-purple-400 rounded px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors">
                      <PlusCircle className="w-4 h-4" />
                      <span>Add Block to End</span>
                    </button>
                  }
                />
              </div>
            </DndContext>
          ) : (
            <p className="text-gray-400">No pages yet. Add one to get started.</p>
          )}
        </div>
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/80 z-50 p-6 overflow-auto">
          <DynamicBlockEditor
            block={editing}
            onSave={(updatedBlock) => {
              const updated = { ...template };
              for (const page of updated.data.pages) {
                const index = page.content_blocks.findIndex((b) => b._id === updatedBlock._id);
                if (index !== -1) {
                  page.content_blocks[index] = updatedBlock;
                  break;
                }
              }
              updateAndSave(updated);
              setEditing(null);
            }}
            onClose={() => setEditing(null)}
            // errors={errors?.[editing._id ?? ''] || {}}
            template={template}
          />
        </div>
      )}
    </div>
  );
}
