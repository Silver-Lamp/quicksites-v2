// app/admin/upload.tsx
'use client';

import { useEffect, useState } from 'react';

const MAX_MB = 8;
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>('');
  const [err, setErr] = useState<string>('');

  useEffect(() => {
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const chooseFile = (f: File | null) => {
    setMsg('');
    setErr('');
    if (!f) return setFile(null);

    if (!ACCEPTED.includes(f.type)) {
      return setErr('Please upload a PNG, JPG, or WebP image.');
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return setErr(`File is too large. Max ${MAX_MB} MB.`);
    }
    setFile(f);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0] || null;
    if (f) chooseFile(f);
  };

  const upload = async () => {
    if (!file || busy) return;
    setBusy(true);
    setMsg('');
    setErr('');

    try {
      const form = new FormData();
      form.append('file', file);

      const res = await fetch('/api/admin/upload-template-image', {
        method: 'POST',
        body: form,
        credentials: 'include', // send Supabase cookies
        cache: 'no-store',
      });

      // Try to read JSON; the endpoint might also return {url,...}
      const data = await res.json().catch(() => ({} as any));
      if (!res.ok) {
        throw new Error(data?.error || data?.message || res.statusText);
      }

      const url: string | undefined =
        data?.url || data?.publicUrl || data?.path || undefined;

      setMsg(url ? `✅ Uploaded!` : '✅ Uploaded!');
      if (url) {
        // Optional: show the returned URL
        setMsg(`✅ Uploaded! ${url}`);
      }
      // Reset selection after success if you prefer:
      // setFile(null);
    } catch (e: any) {
      setErr(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl p-6">
      <h1 className="mb-4 text-xl font-bold">🖼 Upload Template Screenshot</h1>

      {/* Dropzone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={onDrop}
        className={[
          'rounded-2xl border border-border/60 bg-card p-6 text-sm transition-colors',
          dragActive ? 'bg-muted/40' : '',
        ].join(' ')}
        aria-label="Upload image dropzone"
      >
        <p className="mb-2 text-muted-foreground">
          Drag & drop an image here, or choose a file:
        </p>

        <div className="flex items-center gap-3">
          <label className="inline-flex cursor-pointer items-center rounded-md border border-border/60 bg-background px-3 py-2 hover:bg-muted">
            <input
              type="file"
              className="hidden"
              accept={ACCEPTED.join(',')}
              onChange={(e) => chooseFile(e.target.files?.[0] || null)}
            />
            Choose file
          </label>
          <span className="text-xs text-muted-foreground">
            PNG, JPG, or WebP · up to {MAX_MB} MB
          </span>
        </div>

        {file && (
          <div className="mt-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{file.name}</div>
              <div className="text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
            <button
              className="rounded-md border border-border/60 px-2 py-1 text-xs hover:bg-muted"
              onClick={() => chooseFile(null)}
              disabled={busy}
            >
              Clear
            </button>
          </div>
        )}

        {previewUrl && (
          <div className="mt-4 overflow-hidden rounded-lg border border-border/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Selected preview"
              className="max-h-72 w-full object-contain bg-black/5"
            />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={upload}
          disabled={!file || busy}
          className={[
            'rounded-md px-4 py-2 text-sm',
            !file || busy
              ? 'cursor-not-allowed bg-muted text-muted-foreground'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          ].join(' ')}
          aria-busy={busy ? 'true' : 'false'}
        >
          {busy ? 'Uploading…' : 'Upload'}
        </button>

        {err && <p className="text-sm text-red-600">{err}</p>}
        {msg && !err && <p className="text-sm text-green-600">{msg}</p>}
      </div>
    </div>
  );
}
