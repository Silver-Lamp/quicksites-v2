// components/admin/templates/reorderable-page-list.tsx
'use client';

import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import ReorderableBlockList from './reorderable-block-list';
import PageSettingsModal from './page-settings-modal';
import type { Page, Template } from '@/types/template';
import type { Block } from '@/types/blocks';

type ReorderablePageListProps = {
  pages: Page[];
  colorScheme: string;
  onReorder: (pages: Page[]) => void;
  onBlockClick?: (block: Block) => void;
  template: Template;
};

function SortablePage({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className="qs-page-card group relative border rounded mb-6"
    >
      <div
        {...listeners}
        className="absolute -left-6 top-2 text-gray-300 group-hover:text-gray-600 cursor-grab select-none"
        aria-label="Drag to reorder"
        title="Drag to reorder"
      >
        ☰
      </div>
      {children}
    </div>
  );
}

function getPageTitle(page: Page): string {
  const blocks = page.content_blocks || [];
  const hero = blocks.find((b: any) => b.type === 'hero');
  if (hero?.content?.title) return hero.content.title;
  const text = blocks.find((b: any) => b.type === 'text');
  if ((text as any)?.content?.value) return ((text as any).content.value as string).slice(0, 40) + '...';
  return page.slug || page.id || 'Untitled';
}

export default function ReorderablePageList({
  pages,
  colorScheme,
  onBlockClick,
  onReorder,
  template,
}: ReorderablePageListProps) {
  const sensors = useSensors(useSensor(PointerSensor));
  const [settingsPage, setSettingsPage] = useState<Page | null>(null);
  const [search, setSearch] = useState('');
  const [newDraftId, setNewDraftId] = useState<string | null>(null);

  // Keep per-page input refs so we can focus/scroll
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getId = (page: Page, index: number) => page.slug || page.id || `page-${index}`;

  const filteredPages = useMemo(
    () =>
      pages.filter(
        (p) =>
          (p.slug || '').toLowerCase().includes(search.toLowerCase()) ||
          getPageTitle(p).toLowerCase().includes(search.toLowerCase())
      ),
    [pages, search]
  );

  const handleSlugChange = (index: number, newSlug: string) => {
    const updated = [...pages];
    updated[index] = { ...updated[index], slug: newSlug };
    onReorder(updated);
  };

  const handleDelete = (index: number) => {
    const confirmed = confirm('Delete this page?');
    if (!confirmed) return;
    const updated = pages.filter((_, i) => i !== index);
    onReorder(updated);
  };

  const handleDuplicate = (index: number) => {
    const original = pages[index];
    const clone: Page = {
      ...original,
      slug: (original.slug || 'page') + '-copy',
      id: `${original.id || original.slug || 'page'}-${Date.now()}`,
    };
    const updated = [...pages.slice(0, index + 1), clone, ...pages.slice(index + 1)];
    onReorder(updated);
  };

  const handleAddPage = () => {
    const id = `page-${Date.now()}`;
    const newPage: Page = {
      id,
      slug: `new-page-${pages.length + 1}`,
      content_blocks: [],
      title: `New Page ${pages.length + 1}`,
      // mark as draft so we show inline Save/Cancel
      meta: { ...(pages[0]?.meta || {}), isDraft: true } as any,
    };
    onReorder([...pages, newPage]);
    setNewDraftId(id);
  };

  // After adding, scroll the new page into view and focus input
  useEffect(() => {
    if (!newDraftId) return;
    const input = inputRefs.current[newDraftId];
    // scroll the containing card, not just the input, so buttons are visible
    const card = input?.closest('.qs-page-card') as HTMLElement | null;
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // slight delay to ensure layout complete, then focus/select
    const t = setTimeout(() => {
      input?.focus();
      input?.select();
    }, 150);
    return () => clearTimeout(t);
  }, [newDraftId]);

  const handlePageDrag = ({ active, over }: { active: any; over: any }) => {
    if (!over || active.id === over.id) return;
    const oldIndex = pages.findIndex((p, i) => getId(p, i) === active.id);
    const newIndex = pages.findIndex((p, i) => getId(p, i) === over.id);
    const updated = arrayMove(pages, oldIndex, newIndex);
    onReorder(updated);
  };

  const handlePageSave = (updatedPage: Page) => {
    const updatedPages = pages.map((p) =>
      p.id === updatedPage.id ? updatedPage : p
    );
    onReorder(updatedPages);
  };

  // Persist order locally
  useEffect(() => {
    const saved = localStorage.getItem('page-order');
    if (saved) {
      const order = JSON.parse(saved) as string[];
      const reordered = order
        .map((id) => pages.find((p) => p.id === id))
        .filter(Boolean) as Page[];
      const missing = pages.filter((p) => !order.includes(p.id!));
      if (reordered.length > 0) onReorder([...reordered, ...missing]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem('page-order', JSON.stringify(pages.map((p) => p.id)));
  }, [pages]);

  return (
    <>
      <div className="mb-4 flex justify-between items-center">
        <Input
          placeholder="Search by slug or title..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md"
        />
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handlePageDrag}>
        <SortableContext items={filteredPages.map(getId)} strategy={verticalListSortingStrategy}>
          {filteredPages.map((page, index) => {
            const id = page.id || getId(page, index);
            const isDraft = (page as any)?.meta?.isDraft === true;

            return (
              <SortablePage key={getId(page, index)} id={getId(page, index)}>
                {/* Header row: slug + visibility + actions (now with Save/Cancel for drafts) */}
                <div className="px-4 py-3 bg-muted/50 border-b flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 w-full sm:w-auto sm:max-w-sm flex-1">
                    <Input
                      ref={(el) => {
                        if (el) inputRefs.current[id] = el;
                      }}
                      value={page.slug}
                      onChange={(e) => handleSlugChange(index, e.target.value)}
                      className="w-full text-sm"
                    />
                    {page.meta?.visible === false ? (
                      <span className="px-2 py-0.5 text-xs rounded bg-yellow-200 text-yellow-800">
                        Hidden
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs rounded bg-green-200 text-green-800">
                        Visible
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isDraft ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => {
                            const updated = [...pages];
                            const p = { ...updated[index] } as any;
                            p.meta = { ...(p.meta || {}), isDraft: false };
                            updated[index] = p;
                            onReorder(updated);
                            if (newDraftId === id) setNewDraftId(null);
                          }}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            const updated = pages.filter((pg) => (pg.id || '') !== id);
                            onReorder(updated);
                            if (newDraftId === id) setNewDraftId(null);
                          }}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => setSettingsPage(page)}>
                          ⚙️
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDuplicate(index)}>
                          📄
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDelete(index)}>
                          🗑️
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <ReorderableBlockList
                  data={{ pages: [page] }}
                  colorScheme={colorScheme}
                  onBlockClick={onBlockClick}
                  onReorder={(updatedPageData) => {
                    const updatedPages = [...pages];
                    updatedPages[index] = updatedPageData.pages[0];
                    onReorder(updatedPages);
                  }}
                  template={template as unknown as Template}
                />
              </SortablePage>
            );
          })}
        </SortableContext>
      </DndContext>

      <div className="text-center my-6">
        <Button onClick={handleAddPage}>➕ Add New Page</Button>
      </div>

      <PageSettingsModal
        open={!!settingsPage}
        page={settingsPage}
        onClose={() => setSettingsPage(null)}
        onSave={handlePageSave}
      />
    </>
  );
}
