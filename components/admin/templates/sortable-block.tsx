// components/admin/templates/sortable-block.tsx
'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';

type SortableBlockProps = {
  id: string; // should come from block._id
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
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      layout
      layoutId={id}
      style={style}
      initial={{ opacity: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className={`relative group border rounded p-2 bg-muted transition-all duration-150 ease-in-out ${
        isDragging ? 'z-50 shadow-md' : ''
      }`}
    >
      <div
        {...listeners}
        {...attributes}
        className="absolute -left-6 top-2 cursor-grab text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        <GripVertical className="w-4 h-4" />
      </div>
      {children}
    </motion.div>
  );
}
