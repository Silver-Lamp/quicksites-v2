// components/admin/templates/page-tabs-bar.tsx
'use client';

import * as React from 'react';
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
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  PlusCircle,
  Pencil,
  Save as SaveIcon,
  X as XIcon,
  Link as LinkIcon,
  Trash2,
} from 'lucide-react';
import type { Page, Template } from '@/types/template';

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const stableId = (p: Page, i: number) => p.id || p.slug || `page-${i}`;

type Props = {
  pages: Page[];
  selectedIndex: number;
  template: Template;
  onSelect: (index: number) => void;
  onAdd: (newPage: Page) => void;
  onRename: (index: number, title: string, slug: string) => void;
  onDelete: (index: number) => void;
  onReorder: (oldIndex: number, newIndex: number) => void;
};

export default function PageTabsBar({
  pages,
  selectedIndex,
  template,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const selected = pages[selectedIndex];

  const [editingIdx, setEditingIdx] = React.useState<number | null>(null);
  const [title, setTitle] = React.useState(selected?.title ?? '');
  const [slug, setSlug] = React.useState(selected?.slug ?? '');

  React.useEffect(() => {
    if (editingIdx === null) {
      setTitle(selected?.title ?? '');
      setSlug(selected?.slug ?? '');
    }
  }, [selectedIndex, pages, editingIdx, selected]);

  const beginEdit = (i: number) => {
    setEditingIdx(i);
    setTitle(pages[i]?.title ?? '');
    setSlug(pages[i]?.slug ?? '');
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setTitle(selected?.title ?? '');
    setSlug(selected?.slug ?? '');
  };

  const commitEdit = () => {
    if (editingIdx === null) return;
    const rawTitle = (title ?? '').trim();
    const rawSlug = ((slug ?? '') || slugify(rawTitle || 'page')).trim();
    if (!rawTitle) return;

    const tset = new Set(
      pages
        .map((p, i) => (i === editingIdx ? '' : (p.title || '').toLowerCase().trim()))
        .filter(Boolean)
    );
    if (tset.has(rawTitle.toLowerCase())) {
      alert(`A page titled “${rawTitle}” already exists.`);
      return;
    }

    const existing = new Set(pages.map((p, i) => (i === editingIdx ? '' : p.slug)).filter(Boolean));
    let finalSlug = slugify(rawSlug);
    if (existing.has(finalSlug)) {
      const base = finalSlug.replace(/-\d+$/, '');
      let n = 2;
      while (existing.has(`${base}-${n}`)) n++;
      finalSlug = `${base}-${n}`;
    }

    onRename(editingIdx, rawTitle, finalSlug);
    setEditingIdx(null);
  };

  const addPage = () => {
    const baseTitle = 'New Page';
    const seedSlug = slugify(baseTitle);
    const existing = new Set(pages.map((p) => p.slug));
    let nextSlug = seedSlug;
    if (existing.has(nextSlug)) {
      let n = 2;
      while (existing.has(`${seedSlug}-${n}`)) n++;
      nextSlug = `${seedSlug}-${n}`;
    }
    const newPage: Page = {
      id: crypto.randomUUID(),
      slug: nextSlug,
      title: baseTitle,
      content_blocks: [],
      show_header: true,
      show_footer: true,
      site_id: template.site_id ?? null,
    };
    onAdd(newPage);
  };

  const items = pages.map((p, i) => stableId(p, i));

  const confirmDelete = (idx: number) => {
    if (pages.length <= 1) {
      alert('You must have at least one page.');
      return;
    }
    const name = pages[idx]?.title || pages[idx]?.slug || 'this page';
    if (confirm(`Delete “${name}”? This cannot be undone.`)) {
      onDelete(idx);
    }
  };

  return (
    <div className="flex flex-col gap-2 mb-3">
      {/* Row 1: ALL pages, single horizontal line with scroll */}
      <div
        className="relative -mx-2 px-2 overflow-x-auto overflow-y-hidden whitespace-nowrap"
        style={{ scrollbarWidth: 'thin' }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={({ active, over }) => {
            if (!over || active.id === over.id) return;
            const oldIndex = items.findIndex((x) => x === active.id);
            const newIndex = items.findIndex((x) => x === over.id);
            if (oldIndex >= 0 && newIndex >= 0) onReorder(oldIndex, newIndex);
          }}
        >
          <SortableContext items={items} strategy={rectSortingStrategy}>
            <div className="inline-flex items-center gap-2 py-1">
              {pages.map((p, i) => (
                <PageTabItem
                  key={stableId(p, i)}
                  id={stableId(p, i)}
                  page={p}
                  isActive={i === selectedIndex}
                  isEditing={editingIdx === i}
                  title={i === editingIdx ? title : p.title}
                  onClick={() => onSelect(i)}
                  onBeginEdit={() => beginEdit(i)}
                  onTitleChange={(v) => setTitle(v)}
                  onDelete={() => confirmDelete(i)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      {/* Row 2: current page chip + link/slug editor + Add Page */}
      <div className="flex flex-wrap items-center gap-3">
        {selected && (
          <ActiveChip
            isActive
            isEditing={editingIdx === selectedIndex}
            title={editingIdx === selectedIndex ? title : selected.title}
            onBeginEdit={() => beginEdit(selectedIndex)}
            onTitleChange={(v) => setTitle(v)}
            onDelete={() => confirmDelete(selectedIndex)}
          />
        )}

        {selected && (
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-xs text-zinc-300">
              <LinkIcon className="h-3.5 w-3.5" />
              <span className="font-mono">/sites/{template.slug}/</span>
            </div>

            {editingIdx === selectedIndex ? (
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                placeholder="slug"
                className="font-mono text-xs bg-zinc-900 text-zinc-100 border border-zinc-700 rounded px-2 py-1 w-48"
              />
            ) : (
              <span className="font-mono text-xs text-zinc-300">{selected.slug}</span>
            )}

            {editingIdx === selectedIndex && (
              <div className="flex items-center gap-2 ml-1">
                <button
                  onClick={commitEdit}
                  className="inline-flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1 rounded"
                  title="Save"
                >
                  <SaveIcon className="h-3.5 w-3.5" />
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="inline-flex items-center gap-1 text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded"
                  title="Cancel"
                >
                  <XIcon className="h-3.5 w-3.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        <button
          onClick={addPage}
          className="inline-flex items-center gap-2 px-3 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white border border-emerald-500 shadow"
          title="Add Page"
        >
          <PlusCircle className="h-4 w-4" />
          Add Page
        </button>
      </div>
    </div>
  );
}

function PageTabItem({
  id,
  page,
  isActive,
  isEditing,
  title,
  onClick,
  onBeginEdit,
  onTitleChange,
  onDelete,
}: {
  id: string;
  page: Page;
  isActive: boolean;
  isEditing: boolean;
  title?: string;
  onClick: () => void;
  onBeginEdit: () => void;
  onTitleChange: (v: string) => void;
  onDelete: () => void;
}) {
  const { setNodeRef, transform, transition, attributes, listeners } = useSortable({ id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div ref={setNodeRef} style={style} className="inline-block">
      <div
        className={`flex items-center gap-2 px-3 py-1 rounded border cursor-pointer select-none
          ${isActive
            ? 'bg-purple-700 text-white border-purple-500'
            : 'bg-zinc-900 text-zinc-100 border-zinc-700 hover:bg-zinc-800'
          }`}
        onClick={onClick}
      >
        {/* Drag handle ONLY */}
        <button
          type="button"
          aria-label="Drag to reorder"
          className="shrink-0 opacity-80 hover:opacity-100 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>

        {!isEditing ? (
          <>
            <span className="capitalize whitespace-nowrap">{page.title || page.slug}</span>

            {isActive && (
              <>
                <button
                  type="button"
                  title="Rename"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBeginEdit();
                  }}
                  className="ml-1 opacity-90 hover:opacity-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  title="Delete page"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="ml-1 opacity-90 hover:opacity-100 text-red-300 hover:text-red-200"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </>
            )}
          </>
        ) : (
          <input
            autoFocus
            value={title ?? ''}
            onChange={(e) => onTitleChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Title"
            className="bg-transparent border-b border-white/70 focus:outline-none focus:border-white px-1 text-white w-40"
          />
        )}
      </div>
    </div>
  );
}

/** Non-draggable chip for the second row */
function ActiveChip({
  isActive,
  isEditing,
  title,
  onBeginEdit,
  onTitleChange,
  onDelete,
}: {
  isActive: boolean;
  isEditing: boolean;
  title?: string;
  onBeginEdit: () => void;
  onTitleChange: (v: string) => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-1 rounded border select-none
        ${isActive
          ? 'bg-purple-700 text-white border-purple-500'
          : 'bg-zinc-900 text-zinc-100 border-zinc-700'
        }`}
    >
      {!isEditing ? (
        <>
          <span className="capitalize">{title ?? ''}</span>
          <button
            type="button"
            title="Rename"
            onClick={onBeginEdit}
            className="ml-1 opacity-90 hover:opacity-100"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title="Delete page"
            onClick={onDelete}
            className="ml-1 opacity-90 hover:opacity-100 text-red-300 hover:text-red-200"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </>
      ) : (
        <input
          autoFocus
          value={title ?? ''}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Title"
          className="bg-transparent border-b border-white/70 focus:outline-none focus:border-white px-1 text-white w-40"
        />
      )}
    </div>
  );
}
