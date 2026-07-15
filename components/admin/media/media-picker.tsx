'use client';

// A scoped image library for the hero editor. Fetches thumbnails from
// /api/media/assets and lets the owner widen the search from "this site" out to
// "same industry", "all my sites", and "public" (images on published sites).
// Selecting a thumbnail hands its URL back via onSelect. Uploading a new file
// runs through the shared uploadToStorage helper, records it in the registry,
// then re-fetches and auto-selects it.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, UploadCloud, ImageIcon } from 'lucide-react';
import { uploadToStorage } from '@/lib/uploadToStorage';
import type { MediaScope } from '@/lib/media/mediaAssets';

type Asset = { id: string; url: string; subject: string | null; kind: string; created_at: string };

type Props = {
  templateId?: string | null;
  industry?: string | null;
  currentUrl?: string | null;
  onSelect: (url: string) => void;
  /** What kind of asset this picker browses (filters the registry). Default 'hero'. */
  kind?: 'hero' | 'logo' | 'favicon' | 'other';
  /** Override how an uploaded file is stored (e.g. logos → 'logos' bucket). Defaults to uploadToStorage into the hero folder. */
  uploadFile?: (file: File) => Promise<string>;
};

const TABS: { scope: MediaScope; label: string }[] = [
  { scope: 'org-industry', label: 'Same industry' },
  { scope: 'site', label: 'This site' },
  { scope: 'org', label: 'All my sites' },
  { scope: 'public', label: 'Public' },
];

export default function MediaPicker({
  templateId,
  industry,
  currentUrl,
  onSelect,
  kind = 'hero',
  uploadFile,
}: Props) {
  const contain = kind === 'logo' || kind === 'favicon';
  const [scope, setScope] = useState<MediaScope>('org-industry');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (activeScope: MediaScope) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ scope: activeScope, kind });
        if (templateId) qs.set('template_id', templateId);
        if (industry) qs.set('industry', industry);
        const res = await fetch(`/api/media/assets?${qs.toString()}`, { cache: 'no-store' });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || 'Failed to load images');
        setAssets(Array.isArray(body.assets) ? body.assets : []);
      } catch (e: any) {
        setError(e?.message || 'Failed to load images');
        setAssets([]);
      } finally {
        setLoading(false);
      }
    },
    [templateId, industry, kind]
  );

  useEffect(() => {
    load(scope);
  }, [scope, load]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file || !templateId) return;
    setUploading(true);
    setError(null);
    try {
      const url = uploadFile
        ? await uploadFile(file)
        : await uploadToStorage(file, `template-${templateId}/hero`);
      // Best-effort record; never block selection on the bookkeeping call.
      fetch('/api/media/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template_id: templateId, url, source: 'uploaded', kind }),
      }).catch(() => {});
      onSelect(url);
      await load(scope);
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 rounded border border-white/10 bg-neutral-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => {
            const disabled = t.scope === 'site' && !templateId;
            const active = scope === t.scope;
            return (
              <button
                key={t.scope}
                type="button"
                disabled={disabled}
                onClick={() => setScope(t.scope)}
                className={`rounded px-2 py-1 text-xs border ${
                  active
                    ? 'border-purple-500/70 text-purple-200 bg-purple-500/10'
                    : 'border-white/10 text-neutral-300 hover:bg-white/5'
                } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            disabled={uploading || !templateId}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded border border-white/15 px-2 py-1 text-xs text-neutral-200 hover:bg-white/10 disabled:opacity-40"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UploadCloud className="h-3.5 w-3.5" />}
            Upload
          </button>
        </div>
      </div>

      {error && <div className="mt-2 text-xs text-red-300">{error}</div>}

      <div className="mt-3 min-h-[6rem]">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-neutral-400">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-8 text-neutral-500">
            <ImageIcon className="h-5 w-5" />
            <span className="text-xs">No images here yet.</span>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {assets.map((a) => {
              const selected = currentUrl && a.url === currentUrl;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onSelect(a.url)}
                  title={a.subject || undefined}
                  className={`group relative aspect-video overflow-hidden rounded border ${
                    contain ? 'bg-neutral-800' : ''
                  } ${
                    selected ? 'border-purple-400 ring-2 ring-purple-400/50' : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={a.url}
                    alt={a.subject || 'Image'}
                    className={`h-full w-full ${contain ? 'object-contain p-1.5' : 'object-cover'}`}
                    loading="lazy"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
