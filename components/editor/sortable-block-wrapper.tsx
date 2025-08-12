// components/editor/sortable-block-wrapper.tsx
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
      className={[
        // hover scope
        'group/outer relative rounded-lg p-2',
        // hide border until hover
        'border border-transparent transition-colors',
        'group-hover/outer:border-white/15',
        // dark bg tint (optional; keep if desired)
        'bg-neutral-900 text-neutral-100',
      ].join(' ')}
    >
      {/* Top chrome: handle + block name + (existing) edit/delete */}
      <div
        className={[
          'flex justify-between items-center mb-1 text-xs',
          // hide until hover
          'opacity-0 group-hover/outer:opacity-100 transition-opacity',
          'text-white/80',
        ].join(' ')}
      >
        <div className="flex items-center gap-1">
          {/* Drag handle only visible on hover */}
          <GripVertical
            className="w-3 h-3 text-gray-500 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          />
          <span className="uppercase tracking-wide">{block.type}</span>
        </div>

        {/* Your existing buttons: already hidden until hover before, keep explicit */}
        <div className="flex gap-2">
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

      {/* Adder: hidden until hover */}
      <div className="mt-2" ref={adderRef}>
        <div className="opacity-0 group-hover/outer:opacity-100 transition-opacity">
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
    </div>
  );
}
