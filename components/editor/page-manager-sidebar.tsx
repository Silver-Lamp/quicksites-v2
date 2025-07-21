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
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';
import { GripVertical, PlusCircle, File, Home, Phone, Wrench, User } from 'lucide-react';
import { Template } from '@/types/template';
import { Switch } from '@radix-ui/react-switch';
import { Label } from '@/components/ui/label';

function getPageIcon(slug: string) {
  const lower = slug.toLowerCase();
  if (lower.includes('home')) return <Home className="w-4 h-4 text-green-400 shrink-0" />;
  if (lower.includes('contact')) return <Phone className="w-4 h-4 text-blue-400 shrink-0" />;
  if (lower.includes('services')) return <Wrench className="w-4 h-4 text-orange-400 shrink-0" />;
  if (lower.includes('about')) return <User className="w-4 h-4 text-pink-400 shrink-0" />;
  return <File className="w-4 h-4 text-purple-400 shrink-0" />;
}

export function PageManagerSidebar({
  pages,
  selectedIndex,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  compact = false,
  onToggleHeader,
  onToggleFooter,
  templateShowHeader,
  templateShowFooter,
}: {
  pages: Template['data']['pages'];
  selectedIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRename: (index: number, title: string) => void;
  onDelete: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
  compact?: boolean;
  onToggleHeader: (index: number, value: boolean) => void;
  onToggleFooter: (index: number, value: boolean) => void;
  templateShowHeader?: boolean;
  templateShowFooter?: boolean;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');

  const sensors = useSensors(useSensor(PointerSensor));

  return (
    <div className={`p-3 space-y-3 ${compact ? 'text-xs leading-tight' : 'text-sm'}`}>
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-white">Pages</h3>
        <button
          onClick={onAdd}
          className="text-green-400 hover:underline flex items-center gap-1"
        >
          <PlusCircle className="w-4 h-4" /> Add
        </button>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          const oldIndex = pages.findIndex((p) => p.slug === active.id);
          const newIndex = pages.findIndex((p) => p.slug === over.id);
          if (oldIndex !== -1 && newIndex !== -1) {
            onReorder(oldIndex, newIndex);
          }
        }}
      >
        <SortableContext
          items={pages.map((p) => p.slug)}
          strategy={verticalListSortingStrategy}
        >
          <ul className="space-y-1">
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
                onToggleHeader={onToggleHeader}
                onToggleFooter={onToggleFooter}
                templateShowHeader={templateShowHeader}
                templateShowFooter={templateShowFooter}
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
  onToggleHeader,
  onToggleFooter,
  templateShowHeader,
  templateShowFooter,
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
  onToggleHeader: (index: number, value: boolean) => void;
  onToggleFooter: (index: number, value: boolean) => void;
  templateShowHeader?: boolean;
  templateShowFooter?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: page.slug });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const effectiveShowHeader = page.show_header ?? templateShowHeader ?? true;
  const effectiveShowFooter = page.show_footer ?? templateShowFooter ?? true;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-2 py-1 rounded group transition ${
        isSelected ? 'bg-neutral-800' : 'hover:bg-neutral-800'
      }`}
      title={page.title}
    >
      <GripVertical
        className="w-4 h-4 text-gray-500 cursor-move"
        {...attributes}
        {...listeners}
      />
      {getPageIcon(page.slug)}

      {editingIndex === index ? (
        <input
          className="w-full bg-neutral-800 border border-neutral-600 px-2 py-1 rounded text-white"
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
            className="text-left flex-1 truncate text-white hover:underline"
          >
            {page.title}
          </button>

          <div className="mt-2 space-y-2 text-sm text-white/80">
            <Label className="flex items-center gap-2">
              <Switch
                checked={effectiveShowHeader}
                onCheckedChange={(val) => onToggleHeader(index, val)}
              />
              Show Header
              {page.show_header === undefined && (
                <span className="text-yellow-400 text-xs">(inherited)</span>
              )}
            </Label>

            <Label className="flex items-center gap-2">
              <Switch
                checked={effectiveShowFooter}
                onCheckedChange={(val) => onToggleFooter(index, val)}
              />
              Show Footer
              {page.show_footer === undefined && (
                <span className="text-yellow-400 text-xs">(inherited)</span>
              )}
            </Label>
          </div>

          <div className="flex gap-2 ml-2 text-xs opacity-80 group-hover:opacity-100">
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
