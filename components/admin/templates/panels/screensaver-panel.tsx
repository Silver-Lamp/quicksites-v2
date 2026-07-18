// components/admin/templates/panels/screensaver-panel.tsx
'use client';

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sparkles } from 'lucide-react';
import type { Template } from '@/types/template';
import { SCREENSAVER_PRESETS, type ScreensaverConfig, type ScreensaverPreset } from '@/lib/screensaver/config';

type Props = { template: Template; onChange: (patch: Partial<Template>) => void };

// The screensaver "wow-factor" service: an ambient image/video that fades in when a visitor
// steps away and dissolves when they return. Stored on meta.screensaver; rendered on the
// published site (components/sites/site-screensaver.tsx).
export default function ScreensaverPanel({ template, onChange }: Props) {
  const meta = (template?.data as any)?.meta ?? {};
  const cfg: ScreensaverConfig = {
    enabled: !!meta?.screensaver?.enabled,
    preset: (meta?.screensaver?.preset as ScreensaverPreset) || 'fireplace',
    assetUrl: meta?.screensaver?.assetUrl || '',
    idleSeconds: Number(meta?.screensaver?.idleSeconds) || 120,
    caption: meta?.screensaver?.caption || '',
  };

  const setCfg = (patch: Partial<ScreensaverConfig>) => {
    const next = { ...cfg, ...patch };
    onChange({ data: { ...(template.data as any), meta: { ...(meta ?? {}), screensaver: next } } });
  };

  return (
    <Collapsible title="Screensaver" id="screensaver" icon={<Sparkles />}>
      <div className="flex items-center justify-between border-t border-white/10 py-2">
        <div>
          <Label className="text-white">Enable screensaver</Label>
          <p className="mt-0.5 text-xs text-white/50">
            An ambient background fades in when a visitor steps away, and dissolves when they’re back.
          </p>
        </div>
        <input type="checkbox" checked={cfg.enabled} onChange={(e) => setCfg({ enabled: e.target.checked })} />
      </div>

      {cfg.enabled && (
        <div className="mt-3 space-y-4">
          <div>
            <Label className="text-white">Background</Label>
            <div className="mt-2 space-y-1.5">
              {SCREENSAVER_PRESETS.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded border border-white/10 bg-neutral-900/40 p-2">
                  <input
                    type="radio"
                    name="screensaver-preset"
                    checked={cfg.preset === p.key}
                    onChange={() => setCfg({ preset: p.key })}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm text-white">{p.label}</span>
                    <span className="block text-xs text-white/50">{p.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {cfg.preset === 'custom' && (
            <div>
              <Label className="text-white">Image or video URL</Label>
              <Input
                type="url"
                placeholder="https://…/your-loop.mp4 or /image.jpg"
                value={cfg.assetUrl}
                onChange={(e) => setCfg({ assetUrl: e.target.value })}
                className="mt-1 border border-gray-700 bg-gray-800 text-white"
              />
              <p className="mt-1 text-xs text-white/50">MP4 loops play muted; images are shown full-bleed.</p>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Label className="text-white">Appears after</Label>
            <Input
              type="number"
              min={15}
              max={3600}
              value={cfg.idleSeconds}
              onChange={(e) => setCfg({ idleSeconds: Number(e.target.value) })}
              className="w-24 border border-gray-700 bg-gray-800 text-white"
            />
            <span className="text-xs text-white/50">seconds idle</span>
          </div>

          <div>
            <Label className="text-white">Caption (optional)</Label>
            <Input
              placeholder="Move or tap to resume"
              value={cfg.caption}
              onChange={(e) => setCfg({ caption: e.target.value })}
              className="mt-1 border border-gray-700 bg-gray-800 text-white"
            />
          </div>

          <p className="rounded border border-white/10 bg-neutral-900/40 p-2 text-xs text-white/50">
            Respects “reduce motion” accessibility settings, plays muted for mobile autoplay, and
            visitors can turn it off. It won’t show while you’re editing.
          </p>
        </div>
      )}
    </Collapsible>
  );
}
