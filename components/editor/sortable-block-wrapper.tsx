'use client';

import { useEffect, useRef, useState } from 'react';
import { GripVertical, AlertTriangle } from 'lucide-react';
import { Block } from '@/types/blocks';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { useClickAway } from 'react-use';
import { Template } from '@/types/template';
import type { BlockValidationError } from '@/hooks/validateTemplateBlocks';

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
  template: Template;
  errors?: BlockValidationError[];
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
  template,
  errors = [],
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

  const invalid = errors.length > 0;

  return (
    <div
      ref={(el) => {
        ref.current = el;
        setNodeRef(el);
      }}
      style={style}
      className={[
        'group/outer relative rounded-lg p-2',
        invalid
          ? 'border border-red-500 bg-red-500/10 shadow-md shadow-red-500/30'
          : 'border border-transparent group-hover/outer:border-white/15',
        'transition-colors bg-neutral-900 text-neutral-100',
      ].join(' ')}
    >
      {/* Top chrome: handle + block name + edit/delete */}
      <div
        className={[
          'flex justify-between items-center mb-1 text-xs',
          'opacity-0 group-hover/outer:opacity-100 transition-opacity',
          invalid ? 'text-red-400' : 'text-white/80',
        ].join(' ')}
      >
        <div className="flex items-center gap-1">
          <GripVertical
            className="w-3 h-3 text-gray-500 cursor-grab active:cursor-grabbing"
            {...attributes}
            {...listeners}
          />
          <span className="uppercase tracking-wide">{block.type}</span>
          {invalid && (
            <span className="flex items-center gap-1 ml-2">
              <AlertTriangle className="w-3 h-3" />
              Invalid ({errors.length})
            </span>
          )}
        </div>

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

      {/* Validation Errors */}
      {invalid && (
        <ul className="mt-2 text-xs text-red-300 list-disc list-inside pl-1 space-y-1">
          {errors.map((err, i) => (
            <li key={i}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span>{err.message}</span>
                {err.field && <code className="text-white">{err.field}</code>}
                {err.code && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-900/30 border border-amber-700/40 text-amber-100 text-[10px]">
                    {err.code}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Adder */}
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
              template={template as Template}
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
