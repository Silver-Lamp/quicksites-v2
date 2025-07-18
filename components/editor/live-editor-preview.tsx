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
import { GripVertical, Pencil, Trash2, PlusCircle } from 'lucide-react';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import { DynamicBlockEditor } from './dynamic-block-editor';
import { Block } from '@/types/blocks';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { useClickAway } from 'react-use';

let undoStack: any[] = [];
let redoStack: any[] = [];

function SortableBlock({
  block,
  blockIndex,
  template,
  pageIndex,
  page,
  setEditing,
  insertedId,
  onChange,
  setLastInsertedId,
}: {
  block: any;
  blockIndex: number;
  template: any;
  pageIndex: number;
  page: any;
  setEditing: (block: any) => void;
  insertedId: string | null;
  onChange: (updated: any) => void;
  setLastInsertedId: (id: string | null) => void;
}) {
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

  const ref = useRef<HTMLDivElement | null>(null);
  const adderRef = useRef<HTMLDivElement | null>(null);
  const [showAdder, setShowAdder] = useState(false);

  useClickAway(adderRef, () => setShowAdder(false));

  useEffect(() => {
    if (insertedId === block._id && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ref.current.classList.add('ring-2', 'ring-purple-400');
      setTimeout(() => {
        ref.current?.classList.remove('ring-2', 'ring-purple-400');
      }, 2000);
    }
  }, [insertedId, block._id]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        setNodeRef(el);
      }}
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
        <div className="hidden group-hover:flex gap-2">
          <button onClick={() => setEditing(block)} className="text-xs text-blue-400 underline">
            <Pencil size={16} />
          </button>
          <button
            onClick={() => {
              const updated = { ...template };
              updated.data.pages[pageIndex].content_blocks.splice(blockIndex, 1);
              onChange(updated);
            }}
            className="text-xs text-red-400 underline"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <RenderBlock block={block} />

      <div className="hidden group-hover:block mt-2 animate-fade-in" ref={adderRef}>
        <BlockAdderGrouped
          onAdd={(type) => {
            const newBlock = createDefaultBlock(type);
            const updated = { ...template };
            const blocks = [...updated.data.pages[pageIndex].content_blocks];
            blocks.splice(blockIndex + 1, 0, newBlock);
            updated.data.pages[pageIndex].content_blocks = blocks;
            setLastInsertedId(newBlock._id ?? null);
            onChange(updated);
            setShowAdder(false);
          }}
          existingBlocks={page.content_blocks}
          triggerElement={
            <button
              onClick={() => setShowAdder(true)}
              className="w-full flex items-center justify-center gap-2 border border-purple-600 text-purple-600 dark:text-purple-400 rounded px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Block Below</span>
            </button>
          }
        />
      </div>
    </div>
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
  const [lastInsertedId, setLastInsertedId] = useState<string | null>(null);

  const updateAndSave = (updated: any) => {
    undoStack.push(JSON.parse(JSON.stringify(template)));
    redoStack = [];
    onChange(updated);
  };

  return (
    <div className="space-y-10 px-4 py-6">
      <div className="text-right text-sm mb-2 space-x-2">
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
            updateAndSave(updated);
          }}
        >
          <h2 className="text-white font-semibold text-lg mb-2">{page.title}</h2>

          <SortableContext
            items={page.content_blocks.map((b: any) => b._id)}
            strategy={verticalListSortingStrategy}
          >
            <div className={layoutMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-6'}>
              {page.content_blocks.map((block: any, blockIndex: number) => (
                <SortableBlock
                  key={block._id}
                  block={block}
                  blockIndex={blockIndex}
                  template={template}
                  pageIndex={pageIndex}
                  page={page}
                  setEditing={setEditing}
                  insertedId={lastInsertedId}
                  onChange={updateAndSave}
                  setLastInsertedId={setLastInsertedId}
                />
              ))}
            </div>
          </SortableContext>

          {/* Sticky footer adder per page */}
          <div className="sticky bottom-0 z-40 bg-white dark:bg-neutral-900 p-4 border-t border-gray-200 dark:border-neutral-700 mt-6">
            <BlockAdderGrouped
              onAdd={(type) => {
                const newBlock = createDefaultBlock(type);
                const updated = { ...template };
                updated.data.pages[pageIndex].content_blocks.push(newBlock);
                setLastInsertedId(newBlock._id ?? null);
                updateAndSave(updated);
              }}
              existingBlocks={page.content_blocks}
              triggerElement={
                <button
                  className="w-full flex items-center justify-center gap-2 border border-purple-600 text-purple-600 dark:text-purple-400 rounded px-4 py-2 text-sm hover:bg-purple-50 dark:hover:bg-purple-900 transition-colors"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add Block to End</span>
                </button>
              }
            />
          </div>
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
              updateAndSave(updated);
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
