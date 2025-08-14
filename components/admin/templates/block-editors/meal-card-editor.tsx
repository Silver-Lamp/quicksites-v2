// components/admin/templates/editors/meal-card-editor.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { createBrowserClient } from '@supabase/ssr';
import { X } from 'lucide-react';
import TagInput from '@/components/ui/tag-input';
import { COMMON_CUISINES } from '@/lib/cuisines';
import { Label } from '@/components/ui/label';

async function uploadEditorImage(file: File, folder = 'editor-images') {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage
    .from('templates')
    .upload(path, file, { upsert: false, cacheControl: '3600', contentType: file.type });
  if (error) throw error;
  const { data } = supabase.storage.from('templates').getPublicUrl(path);
  return data.publicUrl;
}

const field =
  'w-full rounded-lg bg-neutral-900 text-neutral-100 placeholder:text-neutral-500 ' +
  'border border-neutral-700 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] ' +
  'focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400/40';
const label = 'text-xs font-medium text-neutral-300';
const help = 'mt-1 text-[11px] leading-relaxed text-neutral-400';
const row = 'grid grid-cols-1 sm:grid-cols-2 gap-3';

export default function MealCardEditor({ block, onSave, onClose }: BlockEditorProps) {
  const c = (block.content ?? {}) as any;

  const [form, setForm] = useState({
    title: c.title ?? '',
    chef_name: c.chef_name ?? '',
    price: c.price ?? '',
    image_url: c.image_url ?? '',
    description: c.description ?? '',
    cuisines: c.cuisines ?? [],
    availability: c.availability ?? 'Available',
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<{ title?: string; price?: string }>({});
  const dropRef = useRef<HTMLLabelElement | null>(null);
  const [cuisineOptions, setCuisineOptions] = useState<string[]>(COMMON_CUISINES);
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  // basic validations
  useEffect(() => {
    const next: typeof err = {};
    if (!form.title.trim()) next.title = 'Title is required.';
    if (form.price && !/^(\$?\d+([.,]\d{2})?)$/.test(form.price.trim()))
      next.price = 'Use $10 or 10.00 format.';
    setErr(next);
  }, [form.title, form.price]);

  // keyboard: Esc cancels
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    const url = await uploadEditorImage(file);
    setForm((f) => ({ ...f, image_url: url }));
  };

  // drag & drop
  useEffect(() => {
    const el = dropRef.current;
    if (!el) return;
    const over = (e: DragEvent) => {
      e.preventDefault();
      el.classList.add('ring-2', 'ring-purple-500/40');
    };
    const leave = (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove('ring-2', 'ring-purple-500/40');
    };
    const drop = async (e: DragEvent) => {
      e.preventDefault();
      el.classList.remove('ring-2', 'ring-purple-500/40');
      const f = e.dataTransfer?.files?.[0];
      if (f) await handleFile(f);
    };
    el.addEventListener('dragover', over);
    el.addEventListener('dragleave', leave);
    el.addEventListener('drop', drop);
    return () => {
      el.removeEventListener('dragover', over);
      el.removeEventListener('dragleave', leave);
      el.removeEventListener('drop', drop);
    };
  }, []);

  const canSave = useMemo(() => Object.keys(err).length === 0, [err]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      block.content = { ...(block.content ?? {}), ...form };
      onSave(block);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 bg-neutral-950 text-neutral-100">
      <div className="space-y-3">
        <div className={row}>
          <label className="flex flex-col gap-1">
            <span className={label}>Title</span>
            <input className={`${field} ${err.title ? 'border-red-500/60' : ''}`} value={form.title} onChange={set('title')} />
            {err.title && <div className="text-[11px] text-red-400 mt-1">{err.title}</div>}
          </label>

          <label className="flex flex-col gap-1">
            <span className={label}>Chef Name</span>
            <input className={field} value={form.chef_name} onChange={set('chef_name')} />
          </label>
        </div>

        <div className={row}>
          <label className="flex flex-col gap-1">
            <span className={label}>Price</span>
            <input className={`${field} ${err.price ? 'border-red-500/60' : ''}`} placeholder="$10" value={form.price} onChange={set('price')} />
            {err.price && <div className="text-[11px] text-red-400 mt-1">{err.price}</div>}
          </label>

          <label className="flex flex-col gap-1">
            <span className={label}>Availability</span>
            <input className={field} placeholder="Available" value={form.availability} onChange={set('availability')} />
          </label>
        </div>

        {/* Image URL + Dropzone + Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <label className="flex flex-col gap-1 lg:col-span-2">
            <span className={label}>Image URL</span>
            <input
              className={field}
              placeholder="https://…"
              value={form.image_url}
              onChange={set('image_url')}
            />
            <p className={help}>
              PNG/JPG/WebP recommended. Drag an image here or use the file picker to upload to Supabase.
            </p>

            <label
              ref={dropRef}
              className="mt-2 flex items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60
                         px-3 py-6 text-neutral-300 hover:bg-neutral-900 cursor-pointer transition-colors"
            >
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <span className="text-sm">Drop image here or <span className="text-purple-300 underline">browse</span></span>
            </label>
          </label>

          <div className="lg:col-span-1">
            <span className={label}>Preview</span>
            <div className="mt-1 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900">
              {form.image_url ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.image_url}
                    alt=""
                    className="block w-full h-40 object-cover"
                    onError={(e) => ((e.currentTarget as HTMLImageElement).style.opacity = '0.35')}
                  />
                  <button
                    type="button"
                    className="absolute top-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/70"
                    onClick={() => setForm((f) => ({ ...f, image_url: '' }))}
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                    Remove
                  </button>
                </div>
              ) : (
                <div className="h-40 grid place-items-center text-neutral-500 text-xs">No image</div>
              )}
            </div>
          </div>
        </div>

        <label className="flex flex-col gap-1">
          <span className={label}>Description</span>
          <textarea className={`${field} min-h-[120px] resize-vertical`} value={form.description} onChange={set('description')} />
        </label>


        <div className="md:col-span-2">
        <Label>Cuisines (tags)</Label>
        <TagInput
            value={selectedCuisines}
            onChange={setSelectedCuisines}
            suggestions={cuisineOptions}
            maxTags={5}
            placeholder="e.g., italian, vegan, gluten-free…"
        />
        </div>

      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-lg border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800"
        >
          Cancel
        </button>
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}
