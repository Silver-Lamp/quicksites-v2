// components/editor/page-manager-sidebar.tsx
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
import { Page, Template } from '@/types/template';
import { Switch } from '@radix-ui/react-switch';
import { Label } from '@/components/ui/label';
import { PageEditFields } from '@/components/page-edit-fields';
import { generateSlug } from '@/lib/utils/generateSlug';

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
  onAdd: (newPage: Page) => void;
  onRename: (index: number, title: string, slug?: string) => void;
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
          onClick={() => {
            const baseTitle = 'New Page';
            const slug = generateSlug(baseTitle);

            const newPage: Page = {
              id: crypto.randomUUID(),
              slug,
              title: baseTitle,
              content_blocks: [],
              show_header: true,
              show_footer: true,
            };

            onAdd(newPage);

            setTimeout(() => {
              const newIndex = pages.length;
              setEditingIndex(newIndex);
              setDraftTitle(newPage.title);
            }, 0);
          }}
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
                pages={pages}
                index={idx}
                isSelected={idx === selectedIndex}
                onSelect={() => onSelect(idx)}
                onRename={(newTitle: string, newSlug: string) => {
                  const otherTitles = new Set(
                    pages.map((p, i) => (i !== idx ? p.title.toLowerCase().trim() : '')).filter(Boolean)
                  );
                  if (otherTitles.has(newTitle.toLowerCase().trim())) {
                    alert(`A page with the title "${newTitle}" already exists.`);
                    return;
                  }
                
                  const otherSlugs = new Set(
                    pages.map((p, i) => (i !== idx ? p.slug : '')).filter(Boolean)
                  );
                  let finalSlug = newSlug.trim();
                  if (otherSlugs.has(finalSlug)) {
                    const base = finalSlug.replace(/-\d+$/, '');
                    let count = 2;
                    while (otherSlugs.has(`${base}-${count}`)) count++;
                    finalSlug = `${base}-${count}`;
                  }
                
                  onRename(idx, newTitle, finalSlug);
                }}
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
  pages,
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
  pages: Template['data']['pages'];
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onRename: (newTitle: string, newSlug: string) => void;
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
        <PageEditFields
          initialTitle={draftTitle}
          initialSlug={page.slug}
          existingSlugs={new Set(pages.map((p, i) => i !== index ? p.slug : ''))}
          onSave={(newTitle, newSlug) => {
            onRename(newTitle, newSlug);
            setEditingIndex(null);
          }}
          onCancel={() => setEditingIndex(null)}
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
