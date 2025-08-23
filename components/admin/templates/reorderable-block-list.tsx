'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import TemplatePreview from './template-preview';
import type { TemplateData, Page, Template } from '@/types/template';
import type { Block } from '@/types/blocks';

type Props = {
  data: TemplateData;
  colorScheme: string;
  onBlockClick?: (block: Block) => void;

  /** Return a guaranteed pages array (required, not optional). */
  onReorder: (updated: { pages: Page[] }) => void;
  template: Template;
};

export default function ReorderableBlockList({
  data,
  colorScheme,
  onBlockClick,
  onReorder,
  template,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const [activePageIdx] = useState(0); // single-page for now

  const pages: Page[] = Array.isArray(data?.pages) ? (data.pages as Page[]) : [];
  const blocks: Block[] = Array.isArray(pages[activePageIdx]?.content_blocks)
    ? (pages[activePageIdx].content_blocks as Block[])
    : [];

  const handleDragEnd = (evt: DragEndEvent) => {
    const { active, over } = evt;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b._id === active.id);
    const newIndex = blocks.findIndex((b) => b._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(blocks, oldIndex, newIndex);

    const nextPages: Page[] = pages.map((p, i) =>
      i === activePageIdx ? { ...p, content_blocks: reordered } : p
    );

    // Send a payload that guarantees pages is present.
    onReorder({ pages: nextPages });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={blocks.map((b) => b._id!)} strategy={verticalListSortingStrategy}>
        <TemplatePreview
          data={data}
          colorScheme={colorScheme}
          theme="clean"
          brand="default"
          onBlockClick={onBlockClick}
          showJsonFallback
          mode="light"
          template={template as Template}
        />
      </SortableContext>
    </DndContext>
  );
}
