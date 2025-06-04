import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { GripVertical } from 'lucide-react';

export function SortableBlockList({
  blocks,
  onChange
}: {
  blocks: any[];
  onChange: (next: any[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = blocks.findIndex((b) => b._id === active.id);
      const newIndex = blocks.findIndex((b) => b._id === over?.id);
      if (oldIndex > -1 && newIndex > -1) {
        const reordered = arrayMove(blocks, oldIndex, newIndex);
        onChange(reordered);
      }
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} sensors={sensors} onDragEnd={handleDragEnd}>
      <SortableContext items={blocks.map((b) => b._id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {blocks.map((block) => (
            <SortableItem key={block._id} block={block} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableItem({ block }: { block: any }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: block._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center justify-between p-3 rounded bg-gray-800 text-white border ${
        isDragging ? 'border-blue-500' : 'border-gray-700'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab mr-2">
        <GripVertical size={16} />
      </div>
      <pre className="text-xs flex-1">{JSON.stringify(block, null, 2)}</pre>
    </div>
  );
}
