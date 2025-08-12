'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2 } from 'lucide-react';

export default function BlockWrapper({
  block,
  children,
  onEdit,
  onDelete,
  showOutlines,
}: {
  block: any;
  children: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  showOutlines: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: block._id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  const frameClasses = showOutlines
    ? 'border border-dashed border-purple-700/40'
    : 'border-0 ring-0 bg-transparent dark:bg-transparent ' +
      'group-hover/blk:ring-1 group-hover/blk:ring-gray-300 dark:group-hover/blk:ring-white/10 ' +
      'group-hover/blk:bg-white dark:group-hover/blk:bg-zinc-900';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={['group/blk relative rounded p-2 transition-colors', frameClasses].join(' ')}
    >
      <div
        className="flex justify-between items-center mb-1 text-xs text-black dark:text-white
                   opacity-0 group-hover/blk:opacity-100 transition-opacity"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex items-center gap-1">
          <GripVertical
            className="w-3 h-3 text-gray-500 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
            aria-label="Drag handle"
          />
          <span className="uppercase tracking-wide">{block.type}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={onEdit} className="text-xs text-blue-500 underline" title="Edit block">
            <Pencil size={16} />
          </button>
          <button onClick={onDelete} className="text-xs text-red-500 underline" title="Delete block">
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      {children}
    </div>
  );
}
