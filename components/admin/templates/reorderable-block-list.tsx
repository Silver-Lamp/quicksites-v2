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
import type { TemplateData } from '@/types/template';
import type { Block } from '@/types/blocks';

type Props = {
  data: TemplateData;
  colorScheme: string;
  onBlockClick?: (block: Block) => void;
  onReorder: (updatedData: TemplateData) => void;
};

export default function ReorderableBlockList({
  data,
  colorScheme,
  onBlockClick,
  onReorder,
}: Props) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));
  const [activePageIdx] = useState(0); // assuming 1-page only for now

  const pages = data?.pages || [];
  const blocks: Block[] = pages[activePageIdx]?.content_blocks || [];

  const handleDragEnd = ({ active, over }: { active: { id: string }; over: { id: string } }) => {
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((b) => b._id === active.id);
    const newIndex = blocks.findIndex((b) => b._id === over.id);
    const reordered = arrayMove(blocks, oldIndex, newIndex);

    const updatedData: TemplateData = {
      ...data,
      pages: data.pages.map((page, i) =>
        i === activePageIdx ? { ...page, content_blocks: reordered } : page
      ),
    };

    onReorder(updatedData);
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCenter} 
      onDragEnd={handleDragEnd as unknown as (event: DragEndEvent) => void}
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
        />
      </SortableContext>
    </DndContext>
  );
}
