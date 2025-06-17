import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ReactNode } from 'react';

type SortableBlockProps = {
  id: string;
  children: ReactNode;
};

export default function SortableBlock({ id, children }: SortableBlockProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
    boxShadow: isDragging ? '0 0 0 2px rgba(0,0,0,0.1)' : undefined,
    scale: isDragging ? 1.02 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="relative group transition-all duration-150 ease-in-out"
    >
      <div
        {...listeners}
        className="absolute -left-6 top-2 cursor-grab text-gray-400 group-hover:text-gray-700 select-none"
      >
        ⋮⋮
      </div>
      {children}
    </div>
  );
}
