// components/admin/templates/block-editors/chef-profile-editor.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { BlockEditorProps } from '@/components/admin/templates/block-editors';
import { createBrowserClient } from '@supabase/ssr';
import { X, Upload } from 'lucide-react';

// ---- uploads ---------------------------------------------------------------
async function uploadEditorImage(file: File, folder = 'editor-images') {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const path = `${folder}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from('templates').upload(path, file, {
    upsert: false,
    cacheControl: '3600',
    contentType: file.type,
  });
  if (error) throw error;
  const { data } = supabase.storage.from('templates').getPublicUrl(path);
  return data.publicUrl;
}

// ---- utils ----------------------------------------------------------------
type Meal = { name: string; price: string; image_url: string; availability: string };

const field =
  'w-full rounded-lg bg-neutral-900 text-neutral-100 placeholder:text-neutral-500 ' +
  'border border-neutral-700 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.02)] ' +
  'focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-400/40';
const label = 'text-xs font-medium text-neutral-300';
const help = 'mt-1 text-[11px] leading-relaxed text-neutral-400';
const row = 'grid grid-cols-1 sm:grid-cols-2 gap-3';

// Returns a canonical https://www.youtube.com/embed/<id>[?start=..&list=..]
// or undefined if the input is empty/invalid/not YouTube.
export function normalizeYouTubeToEmbed(input?: string): string | undefined {
    const raw = (input ?? '').trim();
    if (!raw) return undefined;
  
    // If the user pasted just an 11-char video id, accept it.
    const ID = /^[A-Za-z0-9_-]{11}$/;
    if (ID.test(raw)) return `https://www.youtube.com/embed/${raw}`;
  
    // Make sure we can parse even when protocol is missing.
    let u: URL;
    try {
      u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      return undefined;
    }
  
    const host = u.hostname.replace(/^www\./i, '');
    const isYT = ['youtube.com', 'm.youtube.com', 'youtu.be', 'youtube-nocookie.com'].includes(host);
    if (!isYT) return undefined;
  
    // Extract the video id from the various URL forms.
    let id = '';
  
    // Already embed form
    if (u.pathname.startsWith('/embed/')) {
      id = u.pathname.split('/embed/')[1]?.split('/')[0] ?? '';
    }
    // youtu.be/<id>
    else if (host === 'youtu.be') {
      id = u.pathname.replace(/^\/+/, '').split('/')[0] ?? '';
    }
    // youtube.com/watch?v=<id>
    else if (u.pathname === '/watch') {
      id = u.searchParams.get('v') ?? '';
    }
    // youtube.com/shorts/<id>
    else if (u.pathname.startsWith('/shorts/')) {
      id = u.pathname.split('/shorts/')[1]?.split('/')[0] ?? '';
    }
    // youtube.com/live/<id>
    else if (u.pathname.startsWith('/live/')) {
      id = u.pathname.split('/live/')[1]?.split('/')[0] ?? '';
    }
  
    if (!ID.test(id)) return undefined;
  
    // Keep start time (t/start) and list if present.
    const start = secondsFromYouTubeTime(u.searchParams.get('start') ?? u.searchParams.get('t'));
    const list = u.searchParams.get('list') ?? undefined;
  
    const params = new URLSearchParams();
    if (start) params.set('start', String(start));
    if (list) params.set('list', list);
  
    const qs = params.toString();
    return `https://www.youtube.com/embed/${id}${qs ? `?${qs}` : ''}`;
  }
  
  function secondsFromYouTubeTime(val: string | null): number | undefined {
    if (!val) return undefined;
    if (/^\d+$/.test(val)) return parseInt(val, 10); // "90"
    const m = val.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i); // "1m30s", "2h10m5s"
    if (!m) return undefined;
    const h = parseInt(m[1] || '0', 10);
    const min = parseInt(m[2] || '0', 10);
    const s = parseInt(m[3] || '0', 10);
    const total = h * 3600 + min * 60 + s;
    return total > 0 ? total : undefined;
  }
  
const priceOk = (p: string) => !p || /^(\$?\d+([.,]\d{2})?)$/.test(p.trim());

export default function ChefProfileEditor({ block, onSave, onClose }: BlockEditorProps) {
  const c = (block.content ?? {}) as any;
  const [form, setForm] = useState({
    name: c.name ?? '',
    location: c.location ?? '',
    bio: c.bio ?? '',
    profile_image_url: c.profile_image_url ?? '',
    kitchen_video_url: c.kitchen_video_url ?? '',
    certificationsText: Array.isArray(c.certifications) ? (c.certifications as string[]).join('\n') : '',
  });
  const [meals, setMeals] = useState<Meal[]>(
    Array.isArray(c.meals) && c.meals.length
      ? c.meals
      : [{ name: '', price: '', image_url: '', availability: '' }]
  );

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; mealPrices?: number[] }>({});
  const avatarDropRef = useRef<HTMLLabelElement | null>(null);

  // validations
  useEffect(() => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = 'Name is required.';
    const badIdx: number[] = [];
    meals.forEach((m, i) => {
      if (!priceOk(m.price)) badIdx.push(i);
    });
    if (badIdx.length) next.mealPrices = badIdx;
    setErrors(next);
  }, [form.name, meals]);

  // Esc -> cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k: keyof typeof form) => (e: any) => setForm({ ...form, [k]: e.target.value });

  const setMeal = (i: number, key: keyof Meal, val: string) =>
    setMeals((rows) => rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r)));

  const addMeal = () =>
    setMeals((rows) => [...rows, { name: '', price: '', image_url: '', availability: '' }]);

  const rmMeal = (i: number) => setMeals((rows) => rows.filter((_, idx) => idx !== i));

  const uploadAvatar = async (file?: File | null) => {
    if (!file) return;
    const url = await uploadEditorImage(file);
    setForm((f) => ({ ...f, profile_image_url: url }));
  };

  const uploadMealImage = async (i: number, file?: File | null) => {
    if (!file) return;
    const url = await uploadEditorImage(file);
    setMeal(i, 'image_url', url);
  };

  // drag & drop for avatar
  useEffect(() => {
    const el = avatarDropRef.current;
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
      if (f) await uploadAvatar(f);
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

  const canSave = useMemo(() => Object.keys(errors).length === 0, [errors]);

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      // trim -> normalize -> only include if present & valid
      const raw = (form.kitchen_video_url ?? '').trim();
      const normalized = normalizeYouTubeToEmbed(raw);
      console.log('normalized', normalized);
      const payload = {
        ...(block.content ?? {}),
        name: form.name,
        location: form.location,
        bio: form.bio,
        profile_image_url: form.profile_image_url,
        certifications: form.certificationsText.split('\n').map(s => s.trim()).filter(Boolean),
        meals,
        ...(normalized ? { kitchen_video_url: normalized } : {}), // include only if valid
      };
      console.log('payload', payload);
      
      block.content = payload as any;
      onSave(block);
    } finally {
      setSaving(false);
    }
  };
  

  return (
    <div className="p-4 bg-neutral-950 text-neutral-100">
      {/* Name / Location */}
      <div className={row}>
        <label className="flex flex-col gap-1">
          <span className={label}>Name</span>
          <input className={`${field} ${errors.name ? 'border-red-500/60' : ''}`} value={form.name} onChange={set('name')} />
          {errors.name && <div className="text-[11px] text-red-400 mt-1">{errors.name}</div>}
        </label>

        <label className="flex flex-col gap-1">
          <span className={label}>Location</span>
          <input className={field} value={form.location} onChange={set('location')} />
        </label>
      </div>

      {/* Avatar + Dropzone + Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className={label}>Profile Image URL</span>
          <input className={field} value={form.profile_image_url} onChange={set('profile_image_url')} placeholder="https://…" />
          <p className={help}>Prefer PNG/JPG/WebP. Drag an image here or click to upload to Supabase.</p>

          <label
            ref={avatarDropRef}
            className="mt-2 flex items-center justify-center rounded-lg border border-dashed border-neutral-700 bg-neutral-900/60
                       px-3 py-6 text-neutral-300 hover:bg-neutral-900 cursor-pointer transition-colors"
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => uploadAvatar(e.target.files?.[0])}
            />
            <span className="text-sm inline-flex items-center gap-2">
              <Upload className="w-4 h-4 opacity-80" /> Drop image here or <span className="text-purple-300 underline">browse</span>
            </span>
          </label>
        </label>

        <div className="lg:col-span-1">
          <span className={label}>Avatar Preview</span>
          <div className="mt-1 flex items-center gap-3">
            <div className="h-20 w-20 rounded-full overflow-hidden border border-neutral-700 bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {form.profile_image_url ? (
                <img src={form.profile_image_url} alt="" className="block h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full grid place-items-center text-[10px] text-neutral-500">No image</div>
              )}
            </div>
            {form.profile_image_url && (
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs text-white hover:bg-black/70"
                onClick={() => setForm((f) => ({ ...f, profile_image_url: '' }))}
                title="Remove"
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Video */}
      <label className="flex flex-col gap-1 mt-3">
        <span className={label}>Kitchen Video URL</span>
        <input
          className={field}
          value={form.kitchen_video_url}
          onChange={set('kitchen_video_url')}
          placeholder="https://www.youtube.com/watch?v=… or /embed/…"
        />
        <p className={help}>You can paste a standard YouTube link — it will convert to an embed URL on save.</p>
      </label>

      {/* Bio */}
      <label className="flex flex-col gap-1 mt-3">
        <span className={label}>Bio</span>
        <textarea className={`${field} min-h-[120px] resize-vertical`} rows={4} value={form.bio} onChange={set('bio')} />
      </label>

      {/* Certifications */}
      <label className="flex flex-col gap-1 mt-3">
        <span className={label}>Certifications (one per line)</span>
        <textarea className={`${field} min-h-[84px] resize-vertical`} rows={3} value={form.certificationsText} onChange={set('certificationsText')} />
      </label>

      {/* Meals */}
      <div className="mt-4">
        <div className="text-sm font-semibold text-neutral-200 mb-2">Meals</div>
        <div className="space-y-3">
          {meals.map((m, i) => {
            const bad = errors.mealPrices?.includes(i);
            return (
              <div key={i} className="grid grid-cols-1 sm:grid-cols-5 gap-2 items-start">
                <input className={field} placeholder="Name" value={m.name} onChange={(e) => setMeal(i, 'name', e.target.value)} />
                <div>
                  <input
                    className={`${field} ${bad ? 'border-red-500/60' : ''}`}
                    placeholder="$10"
                    value={m.price}
                    onChange={(e) => setMeal(i, 'price', e.target.value)}
                  />
                  {bad && <div className="text-[11px] text-red-400 mt-1">Use $10 or 10.00 format.</div>}
                </div>
                <input className={field} placeholder="Image URL" value={m.image_url} onChange={(e) => setMeal(i, 'image_url', e.target.value)} />
                <input className={field} placeholder="Availability" value={m.availability} onChange={(e) => setMeal(i, 'availability', e.target.value)} />
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200 hover:bg-neutral-800 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 opacity-80" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => uploadMealImage(i, e.target.files?.[0])}
                    />
                  </label>
                  <button
                    className="px-2 py-1 rounded-md bg-neutral-800 text-neutral-200 hover:bg-neutral-700 text-xs"
                    onClick={() => rmMeal(i)}
                    title="Remove meal"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* preview spans full width on small screens */}
                <div className="sm:col-span-5 -mt-1">
                  <div className="mt-1 h-20 rounded-lg overflow-hidden border border-neutral-700 bg-neutral-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="block w-full h-full object-cover" />
                    ) : (
                      <div className="h-full w-full grid place-items-center text-[10px] text-neutral-500">No image</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <button className="px-3 py-1.5 rounded-md border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800" onClick={addMeal}>
            + Add Meal
          </button>
        </div>
      </div>

      {/* Actions */}
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
