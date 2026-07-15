'use client';

// Upload-or-pick image field for the sender profile (headshot / signature). Replaces raw URL
// pasting: uploads a file to Storage + records it in the media_assets registry (kind =
// 'headshot' | 'signature'), and lets the operator re-pick any image they've used before.
// Selecting or uploading hands the public URL back via onChange.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, UploadCloud, Images, X } from 'lucide-react';
import { uploadToStorage } from '@/lib/uploadToStorage';

type Asset = { id: string; url: string; subject: string | null; kind: string; created_at: string };

export default function SenderImageField({
  label,
  kind,
  value,
  onChange,
  hint,
  round,
}: {
  label: string;
  kind: 'headshot' | 'signature';
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
  /** Render the preview as a circle (headshot) vs. a wide strip (signature). */
  round?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [loadingLib, setLoadingLib] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadLibrary = useCallback(async () => {
    setLoadingLib(true);
    try {
      const res = await fetch(`/api/media/assets?scope=org&kind=${kind}`, { cache: 'no-store' });
      const body = await res.json().catch(() => ({}));
      setAssets(Array.isArray(body.assets) ? body.assets : []);
    } catch {
      setAssets([]);
    } finally {
      setLoadingLib(false);
    }
  }, [kind]);

  useEffect(() => {
    if (showLibrary && assets === null) loadLibrary();
  }, [showLibrary, assets, loadLibrary]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadToStorage(file, `sender-profile/${kind}`);
      // Best-effort registry record so it shows up in the library next time.
      fetch('/api/admin/media/sender-asset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, kind }),
      }).catch(() => {});
      onChange(url);
      setAssets(null); // invalidate the library cache so the new image appears
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-neutral-300">{label}</span>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt=""
            className={`${round ? 'h-14 w-14 rounded-full' : 'h-10 w-28 rounded-md bg-white'} border border-neutral-700 object-contain`}
          />
        ) : (
          <div className={`${round ? 'h-14 w-14 rounded-full' : 'h-10 w-28 rounded-md'} grid place-items-center border border-dashed border-neutral-700 text-neutral-600`}>
            <Images className="h-4 w-4" />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/avif" className="hidden" onChange={handleUpload} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
            Upload
          </button>
          <button
            type="button"
            onClick={() => setShowLibrary((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-200 hover:bg-neutral-800"
          >
            <Images className="h-3.5 w-3.5" />
            Library
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex items-center gap-1 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>
      </div>

      {showLibrary && (
        <div className="mt-1 rounded-lg border border-neutral-800 bg-neutral-950/60 p-2">
          {loadingLib ? (
            <div className="flex items-center justify-center py-6 text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : assets && assets.length > 0 ? (
            <div className="grid grid-cols-5 gap-2">
              {assets.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => { onChange(a.url); setShowLibrary(false); }}
                  className={`aspect-square overflow-hidden rounded border ${a.url === value ? 'border-sky-400 ring-2 ring-sky-400/50' : 'border-neutral-700 hover:border-neutral-500'}`}
                >
                  <img src={a.url} alt="" className="h-full w-full bg-white object-contain" loading="lazy" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-neutral-500">Nothing here yet — upload one and it’ll appear here next time.</div>
          )}
        </div>
      )}

      {error && <span className="text-[11px] text-red-400">{error}</span>}
      {hint && <span className="text-[11px] text-neutral-500">{hint}</span>}
    </div>
  );
}
