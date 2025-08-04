'use client';

import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { DndContext, closestCenter } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import BlockField from './block-field';
import TestimonialBlockComponent from '@/components/admin/templates/render-blocks/testimonial';
import { supabase } from '@/lib/supabaseClient';
import Image from 'next/image';
import { extractFieldErrors } from '../utils/extractFieldErrors';

function SortableItem({ item, index, onEdit, onDelete, isEditing, onChange, onSave, onCancel }: any) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-2 border rounded bg-neutral-800 text-white space-y-1 relative"
    >
      {isEditing ? (
        <div className="space-y-2">
          <BlockField
            type="text"
            label="Quote"
            value={item.quote}
            onChange={(v: string) => onChange({ ...item, quote: v })}
          />
          <BlockField
            type="text"
            label="Attribution"
            value={item.attribution}
            onChange={(v: string) => onChange({ ...item, attribution: v })}
          />
          <BlockField
            type="number"
            label="Rating"
            value={item.rating?.toString() || '5'}
            onChange={(v: number) => onChange({ ...item, rating: v })}
          />
          <div className="flex justify-end gap-2">
            <button onClick={onCancel} className="text-xs px-2 py-1 border rounded">Cancel</button>
            <button onClick={onSave} className="text-xs px-2 py-1 bg-blue-600 rounded text-white">Save</button>
          </div>
        </div>
      ) : (
        <>
          <div className="text-sm">“{item.quote || ''}”</div>
          <div className="text-xs text-gray-400">{item.attribution}</div>
          {item.avatar_url ? (
            <Image
              src={item.avatar_url}
              alt={item.attribution || 'Avatar'}
              width={40}
              height={40}
              className="rounded-full object-cover"
              placeholder="blur"
              blurDataURL="/avatar-blur.png"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gray-700 text-white flex items-center justify-center text-sm font-medium">
              {(item.attribution?.split(' ').map((word: string) => word[0]).join('') || '?').toUpperCase()}
            </div>
          )}
          <div className="absolute top-2 right-2 flex gap-1 text-xs">
            <button onClick={onEdit} {...attributes} {...listeners} className="text-blue-300">✏️</button>
            <button onClick={onDelete} className="text-red-400">🗑</button>
          </div>
        </>
      )}
    </div>
  );
}

export default function TestimonialEditor({ block, onSave, onClose, errors = {} }: BlockEditorProps) {
  const industry = block.industry || 'towing';
  const initial = (block.content as any)?.testimonials || [];
  const [testimonials, setTestimonials] = useState(initial.map((t: any) => ({ ...t, _id: uuidv4() })));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [randomized, setRandomized] = useState<boolean>((block.content as any)?.randomized || false);
  const [preview, setPreview] = useState(true);
  const [aiPrompt, setAiPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const fieldErrors = extractFieldErrors(errors as unknown as string[]);

  const handleSave = () => {
    const content = {
      testimonials: testimonials.map(({ _id, ...t }: any) => t),
      randomized,
    };
    onSave({ ...block, content } as Block);
    onClose();
  };

  return (
    <div className="space-y-4 bg-black text-white border border-black p-4 rounded">
      <h3 className="text-lg font-semibold">Edit Testimonials</h3>

      <DndContext collisionDetection={closestCenter}>
        <SortableContext items={testimonials.map((t: any) => t._id)} strategy={verticalListSortingStrategy}>
          <div className="grid gap-3">
            {testimonials.map((item: any, i: number) => (
              <SortableItem
                key={item._id}
                item={item}
                index={i}
                isEditing={editingId === item._id}
                onEdit={() => setEditingId(item._id)}
                onCancel={() => setEditingId(null)}
                onChange={(updated: any) =>
                  setTestimonials((prev: any) =>
                    prev.map((t: any) => (t._id === item._id ? updated : t))
                  )
                }
                onSave={() => setEditingId(null)}
                onDelete={() =>
                  setTestimonials((prev: any) => prev.filter((t: any) => t._id !== item._id))
                }
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="pt-2">
        <button
          onClick={() => setTestimonials((prev: any) => [...prev, { quote: '', attribution: '', rating: 5, _id: uuidv4() }])}
          className="text-sm bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white"
        >
          ➕ Add Testimonial
        </button>
      </div>

      <div className="pt-2">
        <button onClick={() => setPreview(!preview)} className="text-xs underline text-white/70">
          {preview ? 'Hide' : 'Show'} Preview
        </button>
        {preview && (
          <div className="bg-neutral-900 p-4 mt-2 rounded border border-white/10">
            <TestimonialBlockComponent
              block={{
                ...block,
                content: {
                  testimonials: testimonials.map(({ _id, ...t }: any) => t),
                  randomized,
                },
              } as Block}
            />
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <button
          onClick={onClose}
          className="text-sm px-4 py-2 border border-gray-500 rounded hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="text-sm px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Save
        </button>
      </div>
    </div>
  );
}
