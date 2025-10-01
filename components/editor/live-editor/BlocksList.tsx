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
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import BlockWrapper from '@/components/editor/live-editor/BlockWrapper';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import SafeTriggerButton from '@/components/ui/safe-trigger-button';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import type { Template } from '@/types/template';
import { withSyncedPages } from '@/components/editor/live-editor/helpers';
import { useCallback } from 'react';

// ✨ Treat these as inline-editable
const EDITABLE_TYPES = new Set(['text', 'rich_text', 'markdown']);

export default function BlocksList({
  template,
  colorMode,
  pages,
  selectedPage,
  selectedPageIndex,
  showOutlines,
  onUpdateAndSave,
  onEditBlock,
  setLastInsertedId,
}: {
  template: Template;
  colorMode: 'light' | 'dark';
  pages: any[];
  selectedPage: any;
  selectedPageIndex: number;
  showOutlines: boolean;
  onUpdateAndSave: (t: Template) => Promise<void>;
  onEditBlock: (b: any) => void;
  setLastInsertedId: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const blocks = selectedPage?.content_blocks ?? [];

  const handleReorder = useCallback(
    ({ active, over }: any) => {
      if (!over || active.id === over.id) return;
      const oldIndex = blocks.findIndex((b: any) => b._id === active.id);
      const newIndex = blocks.findIndex((b: any) => b._id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const reordered = arrayMove(blocks, oldIndex, newIndex);
      const updated = withSyncedPages({
        ...template,
        color_mode: colorMode,
        data: {
          ...(template.data ?? {}),
          pages: pages.map((p: any, idx: number) =>
            idx === selectedPageIndex ? { ...p, content_blocks: reordered } : p
          ),
        },
      } as Template);
      onUpdateAndSave(updated);
    },
    [blocks, colorMode, onUpdateAndSave, pages, selectedPageIndex, template]
  );

  // 🔍 Click-to-edit handler (safe: ignores chrome/controls/links)
  const tryEdit = useCallback(
    (e: React.MouseEvent, block: any) => {
      if (!EDITABLE_TYPES.has(block?.type)) return;

      const target = e.target as HTMLElement;

      // Ignore clicks on:
      // - chrome controls or anything that opts out
      if (target.closest('[data-no-edit]')) return;
      // - links (let them be clickable in preview)
      if (target.closest('a[href]')) return;
      // - selection: if user is selecting text, don't hijack
      const sel = window.getSelection?.();
      if (sel && sel.type === 'Range' && (sel.toString?.() || '').trim().length > 0) return;

      e.stopPropagation();
      onEditBlock(block);
      setLastInsertedId(block?._id ?? '');
    },
    [onEditBlock, setLastInsertedId]
  );

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleReorder}>
      <SortableContext
        items={blocks.map((b: any, i: number) => b?._id ?? `idx-${i}`)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-6">
          {blocks.map((block: any, blockIndex: number) => {
            const editable = EDITABLE_TYPES.has(block?.type);

            return (
              <BlockWrapper
                key={block._id || `block-${blockIndex}`}
                block={block}
                showOutlines={showOutlines}
                onEdit={() => onEditBlock(block)}
                onDelete={() => {
                  const updatedPage = {
                    ...selectedPage,
                    content_blocks: blocks.filter((_: any, i: number) => i !== blockIndex),
                  };
                  const next = withSyncedPages({
                    ...template,
                    color_mode: colorMode,
                    data: {
                      ...(template.data ?? {}),
                      pages: pages.map((p: any, idx: number) =>
                        idx === selectedPageIndex ? updatedPage : p
                      ),
                    },
                  } as Template);
                  onUpdateAndSave(next);
                }}
              >
                {/* Add Above (hover) */}
                <BlockAdderGrouped
                  onClose={()=>{}}
                  template={template}
                  onAdd={(type) => {
                    const newBlock = createDefaultBlock(type as any);
                    const updatedPage = {
                      ...selectedPage,
                      content_blocks: [
                        ...blocks.slice(0, blockIndex),
                        newBlock as any,
                        ...blocks.slice(blockIndex),
                      ],
                    };
                    setLastInsertedId((newBlock as any)._id ?? '');
                    onEditBlock(newBlock as any);
                    const next = withSyncedPages({
                      ...template,
                      color_mode: colorMode,
                      data: {
                        ...(template.data ?? {}),
                        pages: pages.map((p: any, idx: number) =>
                          idx === selectedPageIndex ? updatedPage : p
                        ),
                      },
                    } as Template);
                    onUpdateAndSave(next);
                  }}
                  existingBlocks={blocks}
                  triggerElement={
                    <div className="opacity-0 group-hover/blk:opacity-100 transition-opacity pointer-events-none group-hover/blk:pointer-events-auto mb-2">
                      <SafeTriggerButton onClick={() => {}} className="text-sm text-purple-500 hover:underline" data-no-edit>
                        + Add Block Above
                      </SafeTriggerButton>
                    </div>
                  }
                />

                {/* Block content (click-to-edit target) */}
                <div
                  id={`block-${block._id}`}
                  data-block-id={block._id}
                  onClick={(e) => tryEdit(e, block)}
                  onKeyDown={(e) => {
                    if (!editable) return;
                    if (e.key === 'Enter' || e.key === 'F2') {
                      e.preventDefault();
                      onEditBlock(block);
                      setLastInsertedId(block?._id ?? '');
                    }
                  }}
                  tabIndex={editable ? 0 : -1}
                  className={[
                    editable ? 'cursor-text' : 'cursor-default',
                    'relative',
                  ].join(' ')}
                >
                  {/* subtle hover hint for editable blocks */}
                  {editable && (
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 rounded-lg ring-0 transition group-hover/blk:ring-1 group-hover/blk:ring-purple-300/60 dark:group-hover/blk:ring-purple-400/40"
                    />
                  )}
                  <RenderBlock
                    block={block}
                    showDebug={false}
                    colorMode={colorMode}
                    template={template}
                  />
                </div>

                {/* Add Below (hover) */}
                <BlockAdderGrouped
                  onClose={()=>{}}
                  template={template}
                  onAdd={(type) => {
                    const newBlock = createDefaultBlock(type as any);
                    const updatedPage = {
                      ...selectedPage,
                      content_blocks: [
                        ...blocks.slice(0, blockIndex + 1),
                        newBlock as any,
                        ...blocks.slice(blockIndex + 1),
                      ],
                    };
                    setLastInsertedId((newBlock as any)._id ?? '');
                    onEditBlock(newBlock as any);
                    const next = withSyncedPages({
                      ...template,
                      color_mode: colorMode,
                      data: {
                        ...(template.data ?? {}),
                        pages: pages.map((p: any, idx: number) =>
                          idx === selectedPageIndex ? updatedPage : p
                        ),
                      },
                    } as Template);
                    onUpdateAndSave(next);
                  }}
                  existingBlocks={blocks}
                  triggerElement={
                    <div className="opacity-0 group-hover/blk:opacity-100 transition-opacity pointer-events-none group-hover/blk:pointer-events-auto mt-2">
                      <SafeTriggerButton onClick={() => {}} className="text-sm text-purple-500 hover:underline" data-no-edit>
                        + Add Block Below
                      </SafeTriggerButton>
                    </div>
                  }
                />
              </BlockWrapper>
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}
