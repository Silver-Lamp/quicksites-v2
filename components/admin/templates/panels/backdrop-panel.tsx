// components/admin/templates/panels/backdrop-panel.tsx
'use client';

// Pick the site's background layer — the thing that stops a site rendering as one flat
// color. Writes `data.meta.backdrop`, which the render layer reads
// (components/theme/template-theme-wrapper.tsx via lib/theme/backdrops.ts).
//
// Two properties this UI has to be honest about, because they're money and they're easy
// to fudge:
//   • Every style except "Painterly" is free and instant — pure CSS off the site's own
//     theme vars. Picking one is just a save.
//   • "Painterly" is a generated image (~$0.04, gpt-image-1). Selecting it does NOT paint;
//     it needs an explicit button press, so nobody spends by browsing a dropdown. Until an
//     image exists the site keeps whatever it had — the render layer draws no layer at all
//     rather than an empty box.

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Image as ImageIcon, Loader2, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Template } from '@/types/template';
import {
  BACKDROP_STYLES,
  BACKDROP_LABELS,
  BACKDROP_HINTS,
  backdropLayerStyle,
  backdropScrimStyle,
  readBackdrop,
  type BackdropStyle,
  type SiteBackdrop,
} from '@/lib/theme/backdrops';

export default function BackdropPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (patch: Partial<Template>) => void;
}) {
  const current = React.useMemo<SiteBackdrop>(
    () => readBackdrop(template) ?? { style: 'wash', intensity: 50, auto: true },
    [template],
  );
  const [painting, setPainting] = React.useState(false);

  /** Merge a backdrop change into data.meta.backdrop and hand it up for autosave. */
  const patchBackdrop = (next: Partial<SiteBackdrop>) => {
    const data: any = { ...(template.data ?? {}) };
    const meta: any = { ...(data.meta ?? {}) };
    // Any hand-edit clears `auto` so the fleet upgrade never overwrites this choice.
    const backdrop: SiteBackdrop = { ...current, ...next, auto: false };
    data.meta = { ...meta, backdrop };
    onChange({ data } as Partial<Template>);
  };

  const paintNow = async () => {
    if (!template?.id) return;
    setPainting(true);
    try {
      const res = await fetch('/api/admin/templates/paint-backdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          subject: current.subject || null,
          intensity: current.intensity ?? 50,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || j?.ok === false) throw new Error(j?.error || `Paint failed (${res.status})`);
      if (j?.changed && j?.url) {
        patchBackdrop({ style: 'painterly', url: j.url });
        toast.success('Painted a new backdrop');
      } else {
        toast.error(`Nothing painted${j?.reason ? ` — ${String(j.reason).replace(/_/g, ' ')}` : ''}`);
      }
    } catch (e: any) {
      toast.error(e?.message || 'Paint failed');
    } finally {
      setPainting(false);
    }
  };

  const isPainterly = current.style === 'painterly';
  const preview = backdropLayerStyle(current);
  const previewScrim = backdropScrimStyle(current);

  return (
    <Collapsible
      id="backdrop"
      title="Background"
      icon={<ImageIcon />}
      summary={[BACKDROP_LABELS[current.style], `${current.intensity ?? 50}%`]
        .filter(Boolean)
        .join(' · ')}
    >
      <div className="space-y-4">
        {/* Style picker. Each swatch previews with the SAME function the site renders
            with, so what's shown here can't drift from what ships. */}
        <div>
          <Label className="text-xs text-muted-foreground">Style</Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {BACKDROP_STYLES.map((s) => {
              const selected = current.style === s;
              const swatch = backdropLayerStyle(
                s === 'painterly'
                  ? { style: 'painterly', url: current.url ?? null, intensity: current.intensity ?? 50 }
                  : { style: s as BackdropStyle, intensity: current.intensity ?? 50 },
              );
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => patchBackdrop({ style: s as BackdropStyle })}
                  title={BACKDROP_HINTS[s]}
                  className={[
                    'relative h-14 rounded-md border text-left px-2 py-1 overflow-hidden transition',
                    selected ? 'border-primary ring-1 ring-primary' : 'border-border hover:border-primary/50',
                  ].join(' ')}
                >
                  {/* bg-background so the alpha layers composite exactly as they will live */}
                  <span aria-hidden className="absolute inset-0 bg-background" />
                  {swatch ? <span aria-hidden className="absolute inset-0" style={swatch} /> : null}
                  <span className="relative text-[11px] font-medium text-foreground">
                    {BACKDROP_LABELS[s]}
                  </span>
                  {s === 'painterly' ? (
                    <span className="relative block text-[10px] text-muted-foreground">costs ~$0.04</span>
                  ) : null}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{BACKDROP_HINTS[current.style]}</p>
        </div>

        {/* Intensity */}
        <div>
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Intensity</Label>
            <span className="text-xs tabular-nums text-muted-foreground">{current.intensity ?? 50}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={current.intensity ?? 50}
            onChange={(e) => patchBackdrop({ intensity: Number(e.target.value) })}
            className="mt-1 w-full accent-[hsl(var(--primary))]"
            disabled={current.style === 'none'}
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            0% is the same as no background at all.
          </p>
        </div>

        {/* Painterly: subject + the explicit spend button */}
        {isPainterly ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3">
            <Label className="text-xs text-muted-foreground">What should it show?</Label>
            <Input
              value={current.subject ?? ''}
              placeholder="e.g. a quiet workshop interior at dusk"
              onChange={(e) => patchBackdrop({ subject: e.target.value })}
            />
            <p className="text-[11px] text-muted-foreground">
              Leave blank to paint from the site&apos;s industry. Generated backdrops never
              include people.
            </p>

            <button
              type="button"
              onClick={paintNow}
              disabled={painting || !template?.id}
              className="mt-1 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-60"
            >
              {painting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {painting ? 'Painting…' : current.url ? 'Repaint' : 'Paint backdrop'}
            </button>

            {!current.url ? (
              <p className="text-[11px] text-amber-500">
                Nothing painted yet — the site keeps its plain background until you paint one.
              </p>
            ) : null}
          </div>
        ) : null}

        {/* Live preview against the real background token */}
        <div className="relative h-24 overflow-hidden rounded-md border border-border bg-background">
          {preview ? <div aria-hidden className="absolute inset-0" style={preview} /> : null}
          {previewScrim ? <div aria-hidden className="absolute inset-0" style={previewScrim} /> : null}
          <div className="relative flex h-full items-center justify-center">
            <span className="text-sm font-medium text-foreground">Your headline sits here</span>
          </div>
        </div>
      </div>
    </Collapsible>
  );
}
