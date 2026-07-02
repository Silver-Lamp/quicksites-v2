'use client';

// components/merchant/ImageUploadField.tsx
//
// Compact image field: paste a URL, or upload a file. Follows the established
// browser-direct-upload pattern (see components/admin/features/image-upload-card):
// the session-aware browser client uploads to the public `images` bucket, and the
// resolved public URL becomes the value. Reused for the item's main image and each
// variant's image.
import * as React from 'react';
import { supabase } from '@/lib/supabase/client';

const BUCKET = 'images';

type Props = {
  value: string;
  onChange: (url: string) => void;
  folder?: string; // path prefix within the bucket
  placeholder?: string;
};

export default function ImageUploadField({ value, onChange, folder = 'catalog', placeholder = 'Image URL, or upload →' }: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Image must be under 5MB.'); return; }

    setUploading(true);
    setError(null);
    try {
      const safe = file.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
      const path = `${folder}/${Date.now()}_${safe}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      if (!data?.publicUrl) throw new Error('Could not resolve public URL');
      onChange(data.publicUrl);
    } catch (err: any) {
      setError(err?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-9 w-9 rounded object-cover ring-1 ring-neutral-800" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded bg-neutral-900 text-[10px] text-neutral-600 ring-1 ring-neutral-800">img</div>
        )}
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 rounded bg-neutral-900 px-3 py-2 text-xs ring-1 ring-neutral-800"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="whitespace-nowrap rounded bg-neutral-800 px-3 py-2 text-xs ring-1 ring-neutral-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        {value && (
          <button type="button" onClick={() => onChange('')} className="rounded px-2 py-1 text-xs text-neutral-500 hover:bg-neutral-900" aria-label="Clear image">✕</button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      </div>
      {error && <span className="text-[11px] text-red-400">{error}</span>}
    </div>
  );
}
