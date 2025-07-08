import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';

export const SortablePage = ({ id, children }: { id: string; children: ReactNode }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative border rounded mb-4 bg-muted p-1"
    >
      <div
        {...listeners}
        {...attributes}
        className="absolute -left-6 top-2 text-gray-400 group-hover:text-gray-100 cursor-grab select-none"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      {children}
    </div>
  );
};
