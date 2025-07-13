'use client';

import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/types/blocks';
import RenderBlock from './render-block';

type SortableGridBlockProps = {
  items: Block[];
  columns: number;
  onChange: (updated: Block[]) => void;
  onInsert?: (index: number) => void;
  onDelete?: (index: number) => void;
  onEdit?: (index: number) => void;
};

function SortableBlockItem({
  block,
  index,
  onDelete,
  onEdit,
  children,
}: {
  block: Block;
  index: number;
  onDelete?: (index: number) => void;
  onEdit?: (index: number) => void;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block._id! });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="relative group">
      <div
        {...attributes}
        {...listeners}
        className="absolute top-1 left-1 text-xs text-gray-500 group-hover:text-gray-700 cursor-grab z-10"
      >
        ☰
      </div>

      <div className="relative border rounded p-2 bg-white dark:bg-neutral-900">
        {children}

        <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition">
          {onEdit && (
            <button onClick={() => onEdit(index)} className="text-xs text-blue-600">✏️</button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(index)} className="text-xs text-red-600">🗑️</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SortableGridBlock({
  items,
  columns,
  onChange,
  onInsert,
  onDelete,
  onEdit,
}: SortableGridBlockProps) {
  return (
    <SortableContext items={items.map((b) => b._id!)} strategy={verticalListSortingStrategy}>
      <div className={`grid grid-cols-${columns} gap-4`}>
        {items.map((block, index) => (
          <SortableBlockItem
            key={block._id}
            block={block}
            index={index}
            onDelete={onDelete}
            onEdit={onEdit}
          >
            <div id={`block-${block._id}`}>
              <RenderBlock block={block} />
            </div>
          </SortableBlockItem>
        ))}
      </div>
    </SortableContext>
  );
}
