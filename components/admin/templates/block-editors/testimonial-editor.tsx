// testimonial-editor.tsx — safe OpenAI usage via API route
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
import type { Block, TestimonialBlock } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import BlockField from './block-field';
import { Switch } from '@/components/ui/switch';
import TestimonialBlockComponent from '@/components/admin/templates/render-blocks/testimonial';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import type { Database } from '@/types/supabase';
import Image from 'next/image';

function SortableItem({ item, index, onEdit, onDelete }: any) {
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
    </div>
  );
}

const TESTIMONIAL_PRESETS: Record<string, { quote: string; attribution: string }[]> = {
  towing: [
    { quote: "Fast and friendly roadside help — got me out of a jam!", attribution: "Sarah P." },
    { quote: "Affordable, on-time, and super professional.", attribution: "Mike J." },
  ],
};

export default function TestimonialEditor({ block, onSave, onClose }: BlockEditorProps) {
  const industry = block.industry || 'towing';
  const initial = (block.content as any)?.testimonials || [];
  const [testimonials, setTestimonials] = useState(initial.map((t: any) => ({ ...t, _id: uuidv4() })));
  const [editing, setEditing] = useState<any | null>(null);
  const [randomized, setRandomized] = useState<boolean>((block.content as any)?.randomized || false);
  const [preview, setPreview] = useState(true);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [loading, setLoading] = useState(false);

  const supabase = createClientComponentClient<Database>();

async function uploadAvatar(file: File, blockId: string): Promise<string | null> {
  const filename = `avatars/${blockId}-${Date.now()}.${file.name.split('.').pop()}`;
  const { data, error } = await supabase.storage.from('public').upload(filename, file, {
    upsert: true,
  });
  if (error) return null;
  return supabase.storage.from('public').getPublicUrl(filename).data.publicUrl;
}


  const handleSave = () => {
    const content = {
      testimonials: testimonials.map(({ _id, ...t }: { _id: string; [key: string]: any }) => t),
      randomized,
    };
    onSave({ ...block, content } as unknown as Block);
    onClose();
  };

  const generateTestimonial = async () => {
    setLoading(true);
    const res = await fetch('/api/generate-testimonial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: aiPrompt, industry }),
    });
    const data = await res.json();
    const quote = data.quote.replace(/^\"|\"$/g, '').trim();

    const newTestimonial = {
      quote,
      attribution: 'Anonymous',
      rating: 5,
      _id: uuidv4(),
    };

    setTestimonials((prev: { _id: string }[]) => [...prev, newTestimonial]);
    setAiPrompt('');
    setLoading(false);

    await supabase.from('testimonial_presets').insert([
      { industry, quote, attribution: 'Anonymous', tags: ['ai-generated'] },
    ]);
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
                onEdit={() => setEditing(item)}
                onDelete={() => setTestimonials((prev: { _id: string }[]) => prev.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex gap-2">
        <button
          onClick={() =>
            setTestimonials((prev: { _id: string }[]) => [...prev, { quote: '', attribution: '', _id: uuidv4(), rating: 5 }])
          }
          className="text-sm bg-green-600 hover:bg-green-700 px-3 py-1 rounded text-white"
        >
          ➕ Add Testimonial
        </button>
        <button
          onClick={() => {
            const industryKey = (industry || 'towing').toLowerCase();
            const presets = TESTIMONIAL_PRESETS[industryKey] || [];
            const newOnes = presets.map((t) => ({ ...t, _id: uuidv4(), rating: 5 }));
            setTestimonials((prev: { _id: string }[]) => [...prev, ...newOnes]);
          }}
          className="text-sm bg-blue-600 hover:bg-blue-700 px-3 py-1 rounded text-white"
        >
          🪄 Autofill from Industry
        </button>
      </div>

      <div className="pt-2 space-y-2">
        <BlockField
          type="text"
          label="Describe a testimonial"
          placeholder="e.g. 'Mention quick arrival and kindness'"
          value={aiPrompt}
          onChange={setAiPrompt}
        />
        <button
          disabled={loading}
          onClick={generateTestimonial}
          className="bg-indigo-600 hover:bg-indigo-700 px-4 py-1 rounded text-white text-sm"
        >
          {loading ? 'Generating...' : '✨ Generate with AI'}
        </button>
      </div>

      <div className="pt-2">
        <button
          onClick={() => setPreview(!preview)}
          className="text-xs underline text-white/70"
        >
          {preview ? 'Hide' : 'Show'} Preview
        </button>
        {preview && (
          <div className="bg-neutral-900 p-4 mt-2 rounded border border-white/10">
            <TestimonialBlockComponent
              block={{
                ...block,
                content: {
                  testimonials: testimonials.map(({ _id, ...t }: { _id: string; [key: string]: any }) => t),
                  randomized,
                },
              } as TestimonialBlock}
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
