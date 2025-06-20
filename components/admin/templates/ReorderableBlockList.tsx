import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import TemplatePreview from './TemplatePreview';
import { ReorderableBlockListProps } from '@/types/blocks';

// type ReorderableBlockListProps = {
//   data: any;
//   colorScheme: string;
//   onBlockClick?: (block: any) => void;
//   onReorder: (updatedData: any) => void;
// };

export default function ReorderableBlockList({
  data,
  colorScheme,
  onBlockClick,
  onReorder,
}: {
  data: any;
  colorScheme: string;
  onBlockClick?: (block: any) => void;
  onReorder: (updatedData: any) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  const [activePageIdx] = useState(0); // assuming only 1 page for now
  const blocks = data?.pages?.[activePageIdx]?.content_blocks || [];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={({ active, over }) => {
        if (!over || active.id === over.id) return;
        const oldIndex = blocks.findIndex((b: any) => b._id === active.id);
        const newIndex = blocks.findIndex((b: any) => b._id === over.id);
        const reordered = arrayMove(blocks, oldIndex, newIndex);
        const updatedData = {
          ...data,
          pages: data.pages.map((p: any, i: number) =>
            i === activePageIdx ? { ...p, content_blocks: reordered } : p
          ),
        };
        onReorder(updatedData);
      }}
    >
      <SortableContext items={blocks.map((b: any) => b._id)} strategy={verticalListSortingStrategy}>
        <TemplatePreview
          data={data}
          colorScheme={colorScheme}
          // onBlockClick={onBlockClick}
        />
      </SortableContext>
    </DndContext>
  );
}
