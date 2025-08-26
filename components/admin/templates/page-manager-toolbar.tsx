// components/admin/templates/page-manager-toolbar.tsx
'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronsUpDown,
  GripHorizontal,
  Plus,
  X,
  Check,
  Pencil,
  Trash2,
  Home,
  Phone,
  Wrench,
  User,
  File,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { generateSlug } from '@/lib/utils/generateSlug';

type PageLite = {
  id?: string;
  slug: string;
  title?: string;
  show_header?: boolean;
  show_footer?: boolean;
  headerOverride?: any;
  footerOverride?: any;
  content_blocks?: any[];
  site_id?: string;
};

type Props = {
  pages: PageLite[] | undefined;
  currentSlug: string | null | undefined;

  onSelect: (slug: string) => void;

  // Create a new page; parent should add it to template and persist.
  onAdd: (newPage: PageLite) => void;

  // Rename (by slug) — pass both new title and slug
  onRename: (slug: string, next: { title: string; slug: string }) => void;

  // Delete a page by slug
  onDelete: (slug: string) => void;

  // Reorder by index
  onReorder: (oldIndex: number, newIndex: number) => void;

  // Optional for initializing site_id on new pages
  siteId?: string;
};

export default function PageManagerToolbar({
  pages,
  currentSlug,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onReorder,
  siteId,
}: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [editingSlug, setEditingSlug] = React.useState<string | null>(null);
  const [draftTitle, setDraftTitle] = React.useState<string>('');
  const [draftSlug, setDraftSlug] = React.useState<string>('');

  React.useEffect(() => setMounted(true), []);

  // Sensors for drag
  const sensors = useSensors(useSensor(PointerSensor));

  const list = pages ?? [];
  const idx = Math.max(
    0,
    currentSlug ? list.findIndex((p) => p.slug === currentSlug) : 0
  );
  const current = list[idx] ?? null;
  const currentLabel = current?.title || current?.slug || '—';

  // ----- helpers -----
  const existingSlugs = React.useMemo(
    () => new Set(list.map((p) => p.slug)),
    [list]
  );

  function iconFor(slug: string) {
    const s = (slug || '').toLowerCase();
    if (s.includes('home')) return <Home className="w-4 h-4" />;
    if (s.includes('contact')) return <Phone className="w-4 h-4" />;
    if (s.includes('service')) return <Wrench className="w-4 h-4" />;
    if (s.includes('about')) return <User className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  }

  function uniqueSlug(base: string, ignore?: string) {
    const baseSlug = generateSlug(base);
    if (!existingSlugs.has(baseSlug) || baseSlug === ignore) return baseSlug;
    let n = 2;
    while (existingSlugs.has(`${baseSlug}-${n}`) && `${baseSlug}-${n}` !== ignore) {
      n++;
    }
    return `${baseSlug}-${n}`;
  }

  function commitRename(oldSlug: string) {
    const title = draftTitle.trim() || draftSlug.trim() || oldSlug;
    let finalSlug = generateSlug(draftSlug.trim() || title);
    finalSlug = uniqueSlug(finalSlug, oldSlug);

    setEditingSlug(null);
    onRename(oldSlug, { title, slug: finalSlug });
    // Auto-select the renamed page
    onSelect(finalSlug);
  }

  function cancelRename() {
    setEditingSlug(null);
    setDraftTitle('');
    setDraftSlug('');
  }

  function createPage() {
    const baseTitle = 'New Page';
    const slug = uniqueSlug(generateSlug(baseTitle));
    const newPage: PageLite = {
      id: crypto.randomUUID(),
      slug,
      title: baseTitle,
      content_blocks: [],
      show_header: true,
      show_footer: true,
      site_id: siteId ?? '',
    };
    onAdd(newPage);
    // Put the new page into edit mode for quick rename
    setTimeout(() => {
      setEditingSlug(slug);
      setDraftTitle(baseTitle);
      setDraftSlug(slug);
      onSelect(slug);
    }, 0);
  }

  // ----- draggable item -----
  function SortableItem({
    page,
    index,
    isActive,
  }: {
    page: PageLite;
    index: number;
    isActive: boolean;
  }) {
    const { attributes, listeners, setNodeRef, transform, transition } =
      useSortable({ id: page.slug });

    const style: React.CSSProperties = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    const isEditing = editingSlug === page.slug;

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={cn(
          'shrink-0 w-[220px] rounded-lg border border-white/10 bg-neutral-900/80 hover:bg-neutral-900 transition p-3',
          isActive ? 'ring-1 ring-purple-500' : ''
        )}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <button
            className={cn(
              'flex items-center gap-2 px-2 py-1 rounded text-left flex-1',
              isActive ? 'bg-neutral-800' : 'hover:bg-neutral-800'
            )}
            onClick={() => onSelect(page.slug)}
            title={page.title || page.slug}
          >
            <span className="opacity-80">{iconFor(page.slug)}</span>
            <span className="truncate">{page.title || page.slug}</span>
          </button>

          <button
            className="text-xs text-white/70 hover:text-white"
            onClick={() => {
              setEditingSlug(page.slug);
              setDraftTitle(page.title || '');
              setDraftSlug(page.slug);
            }}
            title="Rename"
          >
            <Pencil className="w-4 h-4" />
          </button>

          <button
            className="text-xs text-red-400 hover:text-red-300"
            onClick={() => {
              if (confirm(`Delete page "${page.title || page.slug}"?`)) {
                onDelete(page.slug);
              }
            }}
            title="Delete page"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          {/* drag handle */}
          <button
            className="cursor-grab active:cursor-grabbing text-white/50 hover:text-white/80"
            title="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripHorizontal className="w-4 h-4" />
          </button>
        </div>

        {isEditing && (
          <div className="space-y-2 text-xs">
            <div>
              <label className="block mb-1 opacity-70">Title</label>
              <input
                className="w-full rounded bg-neutral-950 border border-white/10 px-2 py-1"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Page title"
              />
            </div>
            <div>
              <label className="block mb-1 opacity-70">URL / Slug</label>
              <input
                className="w-full rounded bg-neutral-950 border border-white/10 px-2 py-1"
                value={draftSlug}
                onChange={(e) => setDraftSlug(e.target.value)}
                placeholder="my-page"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                className="px-2 py-1 rounded bg-white/10 hover:bg-white/20"
                onClick={cancelRename}
              >
                <X className="w-4 h-4" />
              </button>
              <button
                className="px-2 py-1 rounded bg-purple-600 hover:bg-purple-500"
                onClick={() => commitRename(page.slug)}
                title="Save name & URL"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ----- main button rendered inline in the toolbar -----
  const ButtonInline = (
    <button
      type="button"
      className={cn(
        'inline-flex items-center gap-2 h-8 px-3 rounded-md border border-white/10',
        'bg-neutral-900/90 text-white/90 hover:bg-neutral-800'
      )}
      onClick={() => setOpen((v) => !v)}
      title="Page manager"
    >
      <span className="truncate max-w-[180px]">{currentLabel}</span>
      <ChevronsUpDown className="w-4 h-4 opacity-70" />
    </button>
  );

  // ----- tray content (portal) -----
  const Tray = (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[2147483646]"
      style={{ bottom: 104 }} // ≈ just above your toolbar (tweak if needed)
    >
      <div className="w-screen max-w-5xl rounded-2xl border border-white/10 bg-neutral-950/95 backdrop-blur shadow-lg">
        {/* header row */}
        <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/10">
          <div className="text-sm font-medium opacity-90">Pages</div>
          <div className="flex items-center gap-2">
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-white/10 hover:bg-white/20 text-sm"
              onClick={createPage}
              title="Create page"
            >
              <Plus className="w-4 h-4" />
              New
            </button>
            <button
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 bg-white/10 hover:bg-white/20 text-sm"
              onClick={() => setOpen(false)}
              title="Close"
            >
              <X className="w-4 h-4" />
              Close
            </button>
          </div>
        </div>

        {/* scrolling row with drag-reorder */}
        <div className="px-3 py-3 overflow-x-auto">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={({ active, over }) => {
              if (!over || active.id === over.id) return;
              const oldIndex = list.findIndex((p) => p.slug === active.id);
              const newIndex = list.findIndex((p) => p.slug === over.id);
              if (oldIndex >= 0 && newIndex >= 0) onReorder(oldIndex, newIndex);
            }}
          >
            <SortableContext
              items={list.map((p) => p.slug)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-stretch gap-3">
                {list.map((p, i) => (
                  <SortableItem key={p.slug} page={p} index={i} isActive={p.slug === currentSlug} />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      </div>
    </div>
  );

  if (!mounted) return ButtonInline;

  return (
    <>
      {ButtonInline}
      {open && createPortal(Tray, document.body)}
    </>
  );
}
