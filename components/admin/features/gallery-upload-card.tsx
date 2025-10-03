'use client';

import * as React from 'react';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type GalleryItem = { src: string; alt?: string };

type Props = {
  bucket: string;              // e.g. "images"
  folderPrefix?: string;       // e.g. "portfolio/gallery/"
  onChange: (items: GalleryItem[]) => void; // returns the full ordered list
  value?: GalleryItem[];       // current list
  accept?: string;
};

export default function GalleryUploadCard({
  bucket,
  folderPrefix = 'portfolio/gallery/',
  onChange,
  value = [],
  accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif',
}: Props) {
  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [files, setFiles] = React.useState<FileList | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(e.target.files);
  }

  async function uploadAll() {
    if (!files || files.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      const uploads: string[] = [];
      for (const f of Array.from(files)) {
        if (!f.type.startsWith('image/')) continue;
        const ts = Date.now();
        const safe = f.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
        const path = `${folderPrefix}${ts}_${Math.random().toString(36).slice(2,7)}_${safe}`;
        const { error: upErr } = await supabase.storage.from(bucket).upload(path, f, {
          cacheControl: '3600',
          upsert: false,
        });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
        if (pub?.publicUrl) uploads.push(pub.publicUrl);
      }
      if (uploads.length) onChange([...(value ?? []), ...uploads.map((src) => ({ src }))]);
      setFiles(null);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  function removeAt(i: number) {
    const next = [...value];
    next.splice(i, 1);
    onChange(next);
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= value.length) return;
    const next = [...value];
    const tmp = next[i];
    next[i] = next[j];
    next[j] = tmp;
    onChange(next);
  }

  function setAlt(i: number, alt: string) {
    const next = [...value];
    next[i] = { ...next[i], alt };
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label htmlFor="gallery">Pick images (multi)</Label>
        <Input id="gallery" type="file" accept={accept} multiple onChange={onPick} />
        <div className="flex gap-2">
          <Button onClick={uploadAll} disabled={!files || busy}>{busy ? 'Uploading…' : 'Upload selected'}</Button>
          {err && <span className="text-xs text-red-400">{err}</span>}
        </div>
      </div>

      {value?.length ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {value.map((it, i) => (
            <div key={i} className="rounded-md border p-2 bg-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={it.src} alt={it.alt || ''} className="w-full h-28 object-cover rounded" />
              <Input
                className="mt-2 h-8"
                placeholder="Alt text (optional)"
                value={it.alt || ''}
                onChange={(e) => setAlt(i, e.target.value)}
              />
              <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}>↑</Button>
                  <Button size="sm" variant="outline" onClick={() => move(i, 1)} disabled={i === value.length - 1}>↓</Button>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(it.src)}>Copy</Button>
                  <a href={it.src} target="_blank" rel="noopener noreferrer" className="inline-flex">
                    <Button size="sm" variant="outline">Open</Button>
                  </a>
                  <Button size="sm" variant="destructive" onClick={() => removeAt(i)}>Remove</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-[11px] text-muted-foreground">
        Uploads store in <code>{bucket}/{folderPrefix}</code>. Ordering above is preserved when you save.
      </p>
    </div>
  );
}
