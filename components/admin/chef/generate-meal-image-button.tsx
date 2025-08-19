// components/admin/chef/generate-meal-image-button.tsx
'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';

type Props = {
  title: string;
  description: string;
  cuisines?: string[];
  onDone: (url: string) => void;
  disabled?: boolean;
};

export default function GenerateMealImageButton({
  title,
  description,
  cuisines = [],
  onDone,
  disabled,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [style, setStyle] = React.useState<'photo'|'studio'|'rustic'|'minimalist'|'festive'>('photo');
  const [aspect, setAspect] = React.useState<'square'|'landscape'|'portrait'>('landscape');
  const plainDesc = description?.trim() || '';

  const canGo = !!(title?.trim() || plainDesc);

  async function run() {
    if (!canGo) return toast.error('Add a title or description first');
    setBusy(true);
    try {
      const r = await fetch('/api/chef/meals/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description: plainDesc, cuisines, style, aspect }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || 'Failed to generate image');
      onDone(d.url);
      toast.success('Image added');
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || 'Generation failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="secondary" disabled={disabled || busy}>
          {busy ? 'Generating…' : 'Generate with OpenAI'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-background">
        <div className="space-y-3">
          <div className="text-sm font-semibold">Generate meal image</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Style</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground"
                value={style}
                onChange={(e) => setStyle(e.target.value as any)}
              >
                <option value="photo">Photo</option>
                <option value="studio">Studio</option>
                <option value="rustic">Rustic</option>
                <option value="minimalist">Minimalist</option>
                <option value="festive">Festive</option>
              </select>
            </div>
            <div>
              <Label className="text-xs">Aspect</Label>
              <select
                className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground"
                value={aspect}
                onChange={(e) => setAspect(e.target.value as any)}
              >
                <option value="landscape">Landscape</option>
                <option value="square">Square</option>
                <option value="portrait">Portrait</option>
              </select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Title</Label>
            <Input value={title} readOnly className="text-xs opacity-80" />
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <textarea
              value={plainDesc}
              readOnly
              className="mt-1 h-16 w-full rounded-md border bg-muted/30 px-2 py-1 text-xs text-foreground"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" onClick={run} disabled={!canGo || busy}>
              {busy ? 'Generating…' : 'Generate'}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
