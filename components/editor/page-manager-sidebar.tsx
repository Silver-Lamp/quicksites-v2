'use client';

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useRef, useState } from 'react';
import { GripVertical, Pencil, Trash2, PlusCircle, File } from 'lucide-react';
import { createDefaultBlock } from '@/lib/createDefaultBlock';
import RenderBlock from '@/components/admin/templates/render-block';
import { DynamicBlockEditor } from './dynamic-block-editor';
import BlockAdderGrouped from '@/components/admin/block-adder-grouped';
import { useClickAway } from 'react-use';
import { useMediaQuery } from 'usehooks-ts';
import {
  SortableContext as DndSortableContext,
  useSortable as useDndSortable,
} from '@dnd-kit/sortable';
import { Template } from '@/types/template';

export function PageManagerSidebar({
  pages,
  selectedIndex,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
}: {
  pages: Template['data']['pages'];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRename: (index: number, title: string) => void;
  onDelete: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  return (
    <div className="p-4 space-y-4 sticky top-0">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-bold text-white">Pages</h3>
        <button
          onClick={onAdd}
          className="text-green-500 hover:underline text-sm"
        >
          + Add
        </button>
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          const oldIndex = pages.findIndex((p) => p.slug === active.id);
          const newIndex = pages.findIndex((p) => p.slug === over.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove([...pages], oldIndex, newIndex);
            onReorder(oldIndex, newIndex);
          }
        }}
      >
        <SortableContext items={pages.map((p) => p.slug)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {pages.map((page, idx) => (
              <SidebarPageItem
                key={page.slug}
                page={page}
                index={idx}
                isSelected={idx === selectedIndex}
                onSelect={() => onSelect(idx)}
                onRename={(newTitle: string) => onRename(idx, newTitle)}
                onDelete={() => onDelete(idx)}
                editingIndex={editingIndex}
                setEditingIndex={setEditingIndex}
                draftTitle={draftTitle}
                setDraftTitle={setDraftTitle}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function SidebarPageItem({
  page,
  index,
  isSelected,
  onSelect,
  onRename,
  onDelete,
  editingIndex,
  setEditingIndex,
  draftTitle,
  setDraftTitle,
}: {
  page: Template['data']['pages'][number];
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (newTitle: string) => void;
  onDelete: () => void;
  editingIndex: number | null;
  setEditingIndex: (index: number | null) => void;
  draftTitle: string;
  setDraftTitle: (title: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useDndSortable({ id: page.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`p-2 rounded text-white flex items-center gap-2 ${
        isSelected ? 'bg-neutral-800' : 'hover:bg-neutral-800'
      }`}
      title={page.title}
    >
      <GripVertical className="w-4 h-4 text-gray-500 cursor-move" {...attributes} {...listeners} />
      <File className="w-4 h-4 text-purple-400" />
      {editingIndex === index ? (
        <input
          className="w-full bg-neutral-800 border border-neutral-600 px-2 py-1 rounded"
          value={draftTitle}
          onChange={(e) => setDraftTitle(e.target.value)}
          onBlur={() => {
            onRename(draftTitle);
            setEditingIndex(null);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onRename(draftTitle);
              setEditingIndex(null);
            }
          }}
          autoFocus
        />
      ) : (
        <div className="flex justify-between items-center w-full">
          <button
            onClick={onSelect}
            className="text-left flex-1 truncate"
          >
            {page.title}
          </button>
          <div className="flex gap-2 ml-2 text-sm">
            <button
              onClick={() => {
                setEditingIndex(index);
                setDraftTitle(page.title);
              }}
              className="text-blue-400 hover:underline"
            >
              Edit
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete page "${page.title}"?`)) {
                  onDelete();
                }
              }}
              className="text-red-400 hover:underline"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
