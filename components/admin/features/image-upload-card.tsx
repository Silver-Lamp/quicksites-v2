'use client';

import * as React from 'react';
import { createClient as createBrowserClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Props = {
  /** e.g. "images" (or any bucket you prefer) */
  bucket: string;
  /** called with public URL after successful upload */
  onUploaded: (publicUrl: string) => void;
  /** optional folder prefix within the bucket, e.g. "portfolio/" */
  folderPrefix?: string;
  /** Accept filter; default common image types */
  accept?: string;
};

export default function ImageUploadCard({
  bucket,
  onUploaded,
  folderPrefix = 'uploads/',
  accept = 'image/png,image/jpeg,image/webp,image/avif,image/gif,image/svg+xml',
}: Props) {
  const supabase = React.useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [file, setFile] = React.useState<File | null>(null);
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please choose an image file.');
      return;
    }
    setFile(f);
    setError(null);
    setPreview(URL.createObjectURL(f));
  }

  async function doUpload() {
    if (!file) return;
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Make a nice, mostly unique path
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-z0-9.\-_]/gi, '_').toLowerCase();
      const path = `${folderPrefix}${ts}_${safeName}`;

      // Supabase-js doesn't expose progress for simple uploads; we fake a spinner
      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;

      // Get public URL
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      const publicUrl = pub?.publicUrl;
      if (!publicUrl) throw new Error('Could not resolve public URL');

      onUploaded(publicUrl);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        setFile(null);
        setPreview(null);
        setProgress(null);
      }, 350);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        <Label htmlFor="img">Pick image</Label>
        <Input id="img" type="file" accept={accept} onChange={onPick} />
      </div>

      {preview ? (
        <div className="rounded-md border p-2 bg-black/30">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Preview" className="max-h-64 w-auto rounded" />
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button onClick={doUpload} disabled={!file || uploading}>
          {uploading ? 'Uploading…' : 'Upload image'}
        </Button>
        {progress !== null && (
          <span className="text-xs text-muted-foreground">{progress}%</span>
        )}
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Accepted: PNG, JPG, WebP, AVIF, GIF, SVG. Files are stored in <code>{bucket}</code> and returned as a public URL.
      </p>
    </div>
  );
}
