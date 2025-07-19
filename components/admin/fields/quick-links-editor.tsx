'use client';

import { useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, PlusCircle } from 'lucide-react';
import type { Template } from '@/types/template';

type Link = { label: string; href: string };

function SortableLinkItem({
  link,
  index,
  id,
  onChange,
  onRemove,
  internalSlugs,
  createNewPage,
  focusOnMount,
}: {
  link: Link;
  index: number;
  id: string;
  onChange: (updated: Link) => void;
  onRemove: () => void;
  internalSlugs: string[];
  createNewPage: () => string;
  focusOnMount?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const labelRef = useRef<HTMLInputElement>(null);
  const blockRef = useRef<HTMLDivElement>(null);
  const isLabelMissing = !link.label.trim();
  const isHrefMissing = !link.href.trim();

  useEffect(() => {
    if (focusOnMount && isLabelMissing && labelRef.current) {
      labelRef.current.focus();
    }
  }, [focusOnMount, isLabelMissing]);

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        blockRef.current = el;
      }}
      style={style}
      className="relative bg-neutral-800 border border-neutral-700 rounded p-4 space-y-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical
            {...attributes}
            {...listeners}
            className="w-4 h-4 cursor-move text-gray-500"
          />
          <span className="text-sm text-gray-300">Label #{index + 1}</span>
        </div>
        <button
          onClick={onRemove}
          className="text-red-500 hover:text-red-300"
          title="Remove"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <input
        ref={labelRef}
        aria-invalid={isLabelMissing}
        type="text"
        className={`w-full bg-neutral-900 border rounded px-2 py-1 text-sm ${
          isLabelMissing ? 'border-red-500' : 'border-neutral-700'
        }`}
        placeholder="Link label"
        value={link.label}
        onChange={(e) => onChange({ ...link, label: e.target.value })}
      />
      {isLabelMissing && (
        <p className="text-xs text-red-400">Label is required</p>
      )}

      <div className="flex items-center gap-2 mt-1">
        <select
          className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1 text-sm"
          value={internalSlugs.includes(link.href?.replace(/^\//, '')) ? link.href : ''}
          onChange={(e) => onChange({ ...link, href: e.target.value })}
        >
          <option value="">– Internal Page –</option>
          {internalSlugs.map((slug) => (
            <option key={slug} value={`/${slug}`}>
              /{slug}
            </option>
          ))}
        </select>

        <span className="text-gray-400 text-xs">or URL:</span>

        <input
          aria-invalid={isHrefMissing}
          type="text"
          className={`flex-1 bg-neutral-900 border rounded px-2 py-1 text-sm ${
            isHrefMissing ? 'border-red-500' : 'border-neutral-700'
          }`}
          placeholder="https://..."
          value={link.href}
          onChange={(e) => onChange({ ...link, href: e.target.value })}
        />
      </div>

      {isHrefMissing && (
        <p className="text-xs text-red-400">URL or internal page is required</p>
      )}

      {!internalSlugs.includes(link.href?.replace(/^\//, '')) && (
        <button
          className="text-xs text-green-400 underline mt-1"
          onClick={() => onChange({ ...link, href: createNewPage() })}
        >
          Create internal page for this link
        </button>
      )}
    </div>
  );
}

export default function QuickLinksEditor({
  links,
  onChange,
  template,
}: {
  links: Link[];
  onChange: (updated: Link[]) => void;
  template: Template;
}) {
  const sensors = useSensors(useSensor(PointerSensor));
  const internalSlugs = template?.data.pages.map((p) => p.slug) || [];
  const linkRefs = useRef<(HTMLDivElement | null)[]>([]);

  const createNewPage = (label: string): string => {
    const slug = label.toLowerCase().replace(/\s+/g, '-');
    const newPage = {
      id: crypto.randomUUID(),
      slug,
      title: label,
      content_blocks: [],
    };
    template?.data.pages.push(newPage);
    return `/${slug}`;
  };

  // Scroll to first invalid field on mount or update
  useEffect(() => {
    const firstInvalidIndex = links.findIndex(
      (link) => !link.label.trim() || !link.href.trim()
    );
    if (firstInvalidIndex !== -1) {
      const el = linkRefs.current[firstInvalidIndex];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [links]);

  linkRefs.current = links.map((_, i) => linkRefs.current[i] ?? null);

  return (
    <div className="space-y-4">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={({ active, over }) => {
          if (!over || active.id === over.id) return;
          const oldIndex = links.findIndex((l) => l.label === active.id);
          const newIndex = links.findIndex((l) => l.label === over.id);
          const updated = arrayMove(links, oldIndex, newIndex);
          onChange(updated);
        }}
      >
        <SortableContext
          items={links.map((l) => l.label || `link-${l.href}`)}
          strategy={verticalListSortingStrategy}
        >
          {links.map((link, i) => (
            <div key={i} ref={(el) => {
              linkRefs.current[i] = el;
            }}>
              <SortableLinkItem
                id={link.label || `link-${i}`}
                index={i}
                link={link}
                onChange={(updatedLink) => {
                  const updated = [...links];
                  updated[i] = updatedLink;
                  onChange(updated);
                }}
                onRemove={() => {
                  const updated = [...links];
                  updated.splice(i, 1);
                  onChange(updated);
                }}
                internalSlugs={internalSlugs}
                createNewPage={() =>
                  createNewPage(link.label || `Page ${i + 1}`)
                }
                focusOnMount={i === 0}
              />
            </div>
          ))}
        </SortableContext>
      </DndContext>

      <button
        onClick={() => onChange([...links, { label: '', href: '' }])}
        className="flex items-center gap-2 text-purple-400 hover:text-purple-200 mt-2"
      >
        <PlusCircle size={16} /> Add New Link
      </button>
    </div>
  );
}
