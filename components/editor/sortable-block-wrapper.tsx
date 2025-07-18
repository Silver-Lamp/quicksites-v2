'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical } from 'lucide-react';
import { Block } from '@/types/blocks';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { useClickAway } from 'react-use';

type Props = {
  block: Block;
  index: number;
  listeners: any;
  attributes: any;
  setNodeRef: (node: HTMLElement | null) => void;
  style: React.CSSProperties;
  children?: React.ReactNode;
  setEditing: (block: Block) => void;
  onInsertBlockAt: (index: number, type: Block['type']) => void;
  onDeleteBlockAt: (index: number) => void;
  insertedId: string | null;
  page: any;
};

export default function SortableBlockWrapper({
  block,
  index,
  listeners,
  attributes,
  setNodeRef,
  style,
  children,
  setEditing,
  onInsertBlockAt,
  onDeleteBlockAt,
  insertedId,
  page,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const adderRef = useRef<HTMLDivElement | null>(null);
  const [showAdder, setShowAdder] = useState(false);

  useClickAway(adderRef, () => setShowAdder(false));

  useEffect(() => {
    if (insertedId === block._id && ref.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      ref.current.classList.add('ring-2', 'ring-purple-400');
      setTimeout(() => {
        ref.current?.classList.remove('ring-2', 'ring-purple-400');
      }, 2000);
    }
  }, [insertedId, block._id]);

  return (
    <div
      ref={(el) => {
        ref.current = el;
        setNodeRef(el);
      }}
      style={style}
      className="group relative block-hover p-2 rounded border border-white/10"
    >
      <div className="flex justify-between items-center mb-1 opacity-80 text-xs text-white">
        <div className="flex items-center gap-1">
          <GripVertical
            className="w-3 h-3 text-gray-500 cursor-move"
            {...attributes}
            {...listeners}
          />
          <span className="uppercase tracking-wide">{block.type}</span>
        </div>
        <div className="hidden group-hover:flex gap-2">
          <button
            onClick={() => setEditing(block)}
            className="text-xs text-blue-400 underline"
          >
            Edit
          </button>
          <button
            onClick={() => onDeleteBlockAt(index)}
            className="text-xs text-red-400 underline"
          >
            Delete
          </button>
        </div>
      </div>

      {children}

      <div className="hidden group-hover:block mt-2" ref={adderRef}>
        {showAdder ? (
          <BlockAdderGrouped
            onAdd={(type) => {
              onInsertBlockAt(index + 1, type);
              setShowAdder(false);
            }}
            existingBlocks={page.content_blocks}
            label="Select Block Type"
          />
        ) : (
          <button
            onClick={() => setShowAdder(true)}
            className="text-xs text-purple-400 underline"
          >
            + Add Block Here
          </button>
        )}
      </div>
    </div>
  );
}
