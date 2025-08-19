'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader } from 'lucide-react';

type Result = {
  ok?: boolean;
  mode?: 'preview' | 'saved';
  error?: string;
  profile?: any;
  meals?: any;
};

export default function SeedAllPanel() {
  const [count, setCount] = React.useState(8);
  const [seed, setSeed] = React.useState('');
  const [profileOverwrite, setProfileOverwrite] = React.useState(true);

  const [avatar, setAvatar] = React.useState(true);
  const [avatarStyle, setAvatarStyle] = React.useState<'photo'|'illustration'>('photo');
  const [avatarSize, setAvatarSize] = React.useState<'256x256'|'512x512'|'1024x1024'>('512x512');

  const [genImages, setGenImages] = React.useState(true);
  const [imgStyle, setImgStyle] = React.useState<'photo'|'illustration'>('photo');
  const [imgSize, setImgSize] = React.useState<'256x256'|'512x512'|'1024x1024'>('512x512');
  const [clearExisting, setClearExisting] = React.useState(true);

  const [pending, setPending] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const [res, setRes] = React.useState<Result | null>(null);

  async function run(dryRun: boolean) {
    setPending(true); setErr(null); setRes(null);
    try {
      const r = await fetch('/api/dev/seed/all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          seed: seed || undefined,
          dryRun,

          profileOverwrite,
          avatar, avatarStyle, avatarSize,

          mealsCount: count,
          mealsGenerateImages: genImages,
          mealsImageStyle: imgStyle,
          mealsImageSize: imgSize,
          mealsClearExisting: clearExisting,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || d?.profile?.error || d?.meals?.error || 'Seed failed');
      setRes(d);
    } catch (e: any) {
      setErr(e.message || 'Seed failed');
    } finally { setPending(false); }
  }

  return (
    <div className="rounded-xl border p-4 space-y-4">
      <div className="text-base font-semibold">Seed: Profile + Meals</div>
      {err && <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{err}</div>}

      <div className="grid gap-4 md:grid-cols-3">
        <div>
          <Label>Global Seed (optional)</Label>
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="fixture-XYZ" />
        </div>
        <div>
          <Label>Meals Count</Label>
          <Input type="number" min={1} max={24} value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(24, parseInt(e.target.value || '1', 10))))}/>
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={clearExisting} onChange={(e) => setClearExisting(e.target.checked)} />
            Clear existing meals first
          </label>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1">
          <Label>Profile Overwrite</Label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={profileOverwrite} onChange={(e) => setProfileOverwrite(e.target.checked)} />
            Overwrite existing profile fields
          </label>
        </div>

        <div>
          <Label>Avatar</Label>
          <div className="mt-1 flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm">
              <input type="checkbox" checked={avatar} onChange={(e) => setAvatar(e.target.checked)} />
              Generate avatar (AI)
            </label>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Avatar Style</Label>
            <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
              value={avatarStyle}
              onChange={(e) => setAvatarStyle(e.target.value === 'illustration' ? 'illustration' : 'photo')}
            >
              <option value="photo">photo</option>
              <option value="illustration">illustration</option>
            </select>
          </div>
          <div>
            <Label>Avatar Size</Label>
            <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
              value={avatarSize}
              onChange={(e) => setAvatarSize(e.target.value as any)}
            >
              <option value="256x256">256x256</option>
              <option value="512x512">512x512</option>
              <option value="1024x1024">1024x1024</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" checked={genImages} onChange={(e) => setGenImages(e.target.checked)} />
            Meal photos (AI)
          </label>
        </div>
        <div>
          <Label>Meal Image Style</Label>
          <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
            value={imgStyle}
            onChange={(e) => setImgStyle(e.target.value === 'illustration' ? 'illustration' : 'photo')}
          >
            <option value="photo">photo</option>
            <option value="illustration">illustration</option>
          </select>
        </div>
        <div>
          <Label>Meal Image Size</Label>
          <select className="mt-1 w-full rounded-md border px-3 py-2 text-sm bg-white dark:bg-neutral-900"
            value={imgSize}
            onChange={(e) => setImgSize(e.target.value as any)}
          >
            <option value="256x256">256x256</option>
            <option value="512x512">512x512</option>
            <option value="1024x1024">1024x1024</option>
          </select>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" disabled={pending} onClick={() => run(true)}>
          {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Running…</> : 'Preview (no save)'}
        </Button>
        <Button disabled={pending} onClick={() => run(false)}>
          {pending ? <><Loader className="mr-2 h-4 w-4 animate-spin" />Saving…</> : 'Seed All'}
        </Button>
      </div>

      {res && (
        <div className="text-sm text-muted-foreground">
          <div className="mt-2">
            <div>Status: <span className="font-medium">{res.mode}</span></div>
            <div>Profile: {res.profile?.ok ? 'OK' : `ERR: ${res.profile?.error || '—'}`}</div>
            <div>Meals: {res.meals?.ok ? `OK (${res.meals?.count ?? res.meals?.items?.length ?? 0})` : `ERR: ${res.meals?.error || '—'}`}</div>
          </div>
        </div>
      )}
    </div>
  );
}
