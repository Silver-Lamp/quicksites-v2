// components/admin/meals/meals-autofill-panel.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from 'lucide-react';

type Result = {
  ok?: boolean;
  saved?: boolean;
  count?: number;
  items?: Array<{ id?: string; name?: string; photo_url?: string | null }>;
  error?: string;
};

export default function MealsAutofillPanel() {
  const [count, setCount] = React.useState(6);
  const [seed, setSeed] = React.useState('');
  const [generateImages, setGenerateImages] = React.useState(true);
  const [imageStyle, setImageStyle] = React.useState<'photo'|'illustration'>('photo');
  const [imageSize, setImageSize] = React.useState<'256x256'|'512x512'|'1024x1024'>('512x512');
  const [clearExisting, setClearExisting] = React.useState(false);

  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [res, setRes] = React.useState<Result | null>(null);

  async function run(save: boolean, clear: boolean) {
    setPending(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/chef/meals/autofill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count, seed: seed || undefined,
          generateImages, imageStyle, imageSize,
          save, clearExisting: clear,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Request failed');
      setRes(d);
    } catch (e: any) {
      setErr(e.message || 'Request failed');
    } finally { setPending(false); }
  }

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div className="text-base font-semibold">Meals Autofill</div>
      {err && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label>Count</Label>
          <Input type="number" min={1} max={24} value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))}/>
        </div>
        <div>
          <Label>Seed (optional)</Label>
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="fixture-001" />
        </div>
        <div className="flex items-end gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={generateImages} onChange={(e) => setGenerateImages(e.target.checked)} />
            Generate images (AI)
          </label>
        </div>
        <div>
          <Label>Image Style</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={imageStyle}
            onChange={(e) => setImageStyle(e.target.value === 'illustration' ? 'illustration' : 'photo')}
          >
            <option value="photo">photo</option>
            <option value="illustration">illustration</option>
          </select>
        </div>
        <div>
          <Label>Image Size</Label>
          <select
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            value={imageSize}
            onChange={(e) => setImageSize(e.target.value as any)}
          >
            <option value="256x256">256x256</option>
            <option value="512x512">512x512</option>
            <option value="1024x1024">1024x1024</option>
          </select>
        </div>
        <div className="flex items-end gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clearExisting} onChange={(e) => setClearExisting(e.target.checked)} />
            Clear existing first
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => run(false, false)}>
          {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Running…</> : 'Preview (no save)'}
        </Button>
        <Button disabled={pending} onClick={() => run(true, clearExisting)}>
          {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Generate & Save'}
        </Button>
      </div>

      {res?.items && (
        <div className="mt-2">
          <div className="text-sm text-muted-foreground">
            {res.saved ? `Saved ${res.items.length} meal${res.items.length === 1 ? '' : 's'}.` : `Previewed ${res.items.length} meal${res.items.length === 1 ? '' : 's'}.`}
          </div>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {res.items.slice(0, 8).map((m, i) => (
              <li key={i} className="flex items-center gap-3 rounded-md border p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.photo_url || 'https://placehold.co/80'}
                  alt=""
                  className="h-12 w-12 rounded-md object-cover border"
                />
                <div className="text-sm">{m.name}</div>
              </li>
            ))}
          </ul>
          {res.items.length > 8 && (
            <div className="mt-1 text-xs text-muted-foreground">…and {res.items.length - 8} more</div>
          )}
        </div>
      )}
    </div>
  );
}
