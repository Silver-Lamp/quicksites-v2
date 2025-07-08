// components/admin/templates/sortable-block-board.tsx
'use client';

import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { motion } from 'framer-motion';
import { useState } from 'react';
import type { Template, Page } from '@/types/template';
import { BlockSchema } from '@/admin/lib/zod/blockSchema';
import { GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSortable } from '@dnd-kit/sortable';

type Props = {
  template: Template;
  onChange: (t: Template) => void;
  onLivePreviewUpdate: (d: Template['data']) => void;
  maxBlocksPerPage?: number;
};

export function SortableBlockBoard({ template, onChange, onLivePreviewUpdate, maxBlocksPerPage = 6 }: Props) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);

  const handleDragStart = (event: any) => {
    setDraggingBlockId(event.active.id);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setDraggingBlockId(null);

    if (!over || active.id === over.id) return;

    const fromPage = template.data.pages.find((p) =>
      p.content_blocks.some((b) => b._id === active.id)
    );
    const toPage = template.data.pages.find((p) =>
      p.content_blocks.some((b) => b._id === over.id)
    );

    if (!fromPage || !toPage) return;

    const fromIndex = fromPage.content_blocks.findIndex((b) => b._id === active.id);
    const toIndex = toPage.content_blocks.findIndex((b) => b._id === over.id);

    // Prevent moving to a page over max limit
    if (
      fromPage.id !== toPage.id &&
      toPage.content_blocks.length >= maxBlocksPerPage
    ) {
      return alert('This page already has the max number of blocks');
    }

    const fromBlocks = [...fromPage.content_blocks];
    const [moved] = fromBlocks.splice(fromIndex, 1);

    const toBlocks = [...toPage.content_blocks];
    toBlocks.splice(toIndex, 0, moved);

    const updatedPages = template.data.pages.map((p) => {
      if (p.id === fromPage.id) return { ...p, content_blocks: fromBlocks };
      if (p.id === toPage.id) return { ...p, content_blocks: toBlocks };
      return p;
    });

    const updated = { ...template, data: { ...template.data, pages: updatedPages } };
    onChange(updated);
    onLivePreviewUpdate(updated.data);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="space-y-6">
        {template.data.pages.map((page, index) => (
          <div key={page.id} className="border rounded p-4 bg-muted/50 space-y-2 group">
            <div className="flex justify-between items-center">
              <div className="font-semibold text-sm">{page.title || `Page ${index + 1}`}</div>
              <span className="text-xs text-muted-foreground">
                {page.content_blocks.length} / {maxBlocksPerPage}
              </span>
            </div>

            <SortableContext
              items={page.content_blocks.map((b) => b._id).filter((id): id is string => id !== undefined)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2 min-h-[40px]">
                {page.content_blocks.map((block) => (
                  <SortableBlock key={block._id} block={block} />
                ))}
                {page.content_blocks.length === 0 && (
                  <div className="text-xs text-muted-foreground italic">Drop a block here</div>
                )}
              </div>
            </SortableContext>
          </div>
        ))}
      </div>
    </DndContext>
  );
}

function SortableBlock({ block }: { block: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block._id });

  const style = {
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    transition,
  };

  const isValid = BlockSchema.safeParse(block).success;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      style={style}
      className={`flex items-center justify-between p-3 rounded bg-white/5 border ${
        isDragging ? 'border-blue-500' : isValid ? 'border-gray-700' : 'border-red-500'
      } group relative`}
    >
      <div
        {...listeners}
        {...attributes}
        className="absolute -left-6 top-2 cursor-grab text-gray-500 group-hover:text-white opacity-0 group-hover:opacity-100"
      >
        <GripVertical size={16} />
      </div>
      <div className="text-sm">{block?.type || '(unknown)'}</div>
      {!isValid && (
        <Button size="icon" variant="outline" className="text-xs">
          Fix
        </Button>
      )}
    </motion.div>
  );
}
