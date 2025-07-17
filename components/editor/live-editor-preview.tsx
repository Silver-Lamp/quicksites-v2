// components/editor/LiveEditorPreview.polished.tsx
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
import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import { MotionBlockWrapper } from './motion-block-wrapper';
import { BlockOverlayControls } from './block-overlay-controls';
import { FloatingAddBlockHere } from './floating-add-block-here';
import { AISuggestionOverlay } from './ai-suggestion-overlay';
import RenderBlock from '@/components/admin/templates/render-block';

import { BlockSettingsDrawer } from './block-settings-drawer';
import { DynamicBlockEditor } from './dynamic-block-editor';

type SortableBlockWrapperProps = {
  block: any;
  index: number;
  listeners: any;
  attributes: any;
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  children?: React.ReactNode;
  setEditing: (block: any) => void; // ← ADD THIS
};

let editingBlock = null;

function SortableBlockWrapper({ block, index, listeners, attributes, setNodeRef, style, children, setEditing }: any) {
  return (
    <MotionBlockWrapper key={block._id}>
      <div
        ref={setNodeRef}
        style={style}
        className="group relative block-hover p-2 rounded border border-white/10"
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
          <div className="hidden group-hover:flex">
            <BlockOverlayControls onEdit={() => setEditing(block)} onDelete={() => alert('Delete')} />
          </div>
        </div>

        {children}

        <div className="hidden group-hover:block mt-2">
          <FloatingAddBlockHere onAdd={() => alert('Add block')} />
          <AISuggestionOverlay onSelect={(text) => alert(`AI: ${text}`)} />
        </div>
      </div>
    </MotionBlockWrapper>
  );
}

export function LiveEditorPreview({
  template,
  onChange,
  industry,
  errors,
}: {
  template: any;
  onChange: (updated: any) => void;
  industry: string;
  errors: any;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [layoutMode, setLayoutMode] = useState<'stack' | 'grid'>('stack');
  const [editing, setEditing] = useState<any | null>(null);

  const handleSaveBlock = (updatedBlock: any) => {
    const updated = { ...template };
    for (const page of updated.data.pages) {
      const index = page.content_blocks.findIndex((b: any) => b._id === updatedBlock._id);
      if (index !== -1) {
        page.content_blocks[index] = updatedBlock;
        break;
      }
    }
    onChange(updated);
    setEditing(null);
  };


  return (
    <div className="space-y-10 px-4 py-6">
      <div className="text-right text-sm mb-2">
        <button
          onClick={() => setLayoutMode((m) => (m === 'stack' ? 'grid' : 'stack'))}
          className="text-blue-400 underline"
        >
          View: {layoutMode === 'stack' ? 'Vertical' : 'Grid'}
        </button>
      </div>

      {template.data.pages.map((page: any, pageIndex: number) => (
        <DndContext
          key={page.slug}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const blocks = [...template.data.pages[pageIndex].content_blocks];
            const oldIndex = blocks.findIndex((b) => b._id === active.id);
            const newIndex = blocks.findIndex((b) => b._id === over.id);
            const reordered = arrayMove(blocks, oldIndex, newIndex);
            const updated = { ...template };
            updated.data.pages[pageIndex].content_blocks = reordered;
            onChange(updated);
          }}
        >
          <h2 className="text-white font-semibold text-lg mb-2">{page.title}</h2>
          <SortableContext
            items={page.content_blocks.map((b: any) => b._id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-6'}>
              {page.content_blocks.map((block: any, blockIndex: number) => {
                const { setNodeRef, attributes, listeners, transform, transition } = useSortable({
                  id: block._id,
                });
                const style = {
                  transform: CSS.Transform.toString(transform),
                  transition,
                };
                return (
                  <SortableBlockWrapper
                    key={block._id}
                    block={block}
                    index={blockIndex}
                    setNodeRef={setNodeRef}
                    listeners={listeners}
                    attributes={attributes}
                    style={style}
                    setEditing={setEditing}
                  >
                    <RenderBlock block={block} />
                  </SortableBlockWrapper>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      ))}
    {editing && (
      <div className="fixed inset-0 bg-black/80 z-50 p-6 overflow-auto">
        <DynamicBlockEditor
          block={editing}
          onSave={(updatedBlock) => {
            const updated = { ...template };
            for (const page of updated.data.pages) {
              const index = page.content_blocks.findIndex((b: any) => b._id === updatedBlock._id);
              if (index !== -1) {
                page.content_blocks[index] = updatedBlock;
                break;
              }
            }
            onChange(updated);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
          errors={errors?.[editing._id ?? ''] || []}
          template={template}
        />
      </div>
    )}


    </div>
  );
}
