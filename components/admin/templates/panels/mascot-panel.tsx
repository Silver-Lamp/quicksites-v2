// components/admin/templates/panels/mascot-panel.tsx
'use client';

import * as React from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Dog } from 'lucide-react';
import type { Template } from '@/types/template';
import { MASCOT_SOURCES, type MascotConfig, type MascotSource } from '@/lib/mascot/config';

type Props = { template: Template; onChange: (patch: Partial<Template>) => void };

// "Say Dog" — a friendly video mascot pinned to the corner of the site that pops a speech bubble
// when tapped. Stored on meta.mascot; rendered on the published site (components/sites/site-mascot.tsx).
export default function MascotPanel({ template, onChange }: Props) {
  const meta = (template?.data as any)?.meta ?? {};
  const factsText: string = Array.isArray(meta?.mascot?.facts) ? meta.mascot.facts.join('\n') : '';
  const cfg: MascotConfig = {
    enabled: !!meta?.mascot?.enabled,
    source: (meta?.mascot?.source as MascotSource) || 'facts',
    facts: [],
  };

  const setCfg = (patch: Partial<MascotConfig & { factsText: string }>) => {
    const facts =
      patch.factsText !== undefined
        ? patch.factsText
            .split('\n')
            .map((f) => f.trim())
            .filter(Boolean)
            .slice(0, 30)
        : Array.isArray(meta?.mascot?.facts)
          ? meta.mascot.facts
          : [];
    const next = {
      enabled: patch.enabled ?? cfg.enabled,
      source: patch.source ?? cfg.source,
      facts,
    };
    onChange({ data: { ...(template.data as any), meta: { ...(meta ?? {}), mascot: next } } });
  };

  return (
    <Collapsible title="Mascot (Say Dog)" id="mascot" icon={<Dog />}>
      <div className="flex items-center justify-between border-t border-white/10 py-2">
        <div>
          <Label className="text-white">Enable mascot</Label>
          <p className="mt-0.5 text-xs text-white/50">
            A friendly dog sits in the corner; visitors tap it for a little message.
          </p>
        </div>
        <input
          type="checkbox"
          checked={cfg.enabled}
          onChange={(e) => setCfg({ enabled: e.target.checked })}
        />
      </div>

      {cfg.enabled && (
        <div className="mt-3 space-y-4">
          <div>
            <Label className="text-white">What it says when tapped</Label>
            <div className="mt-2 space-y-1.5">
              {MASCOT_SOURCES.map((s) => (
                <label
                  key={s.key}
                  className="flex cursor-pointer items-start gap-2 rounded border border-white/10 bg-neutral-900/40 p-2"
                >
                  <input
                    type="radio"
                    name="mascot-source"
                    checked={cfg.source === s.key}
                    onChange={() => setCfg({ source: s.key })}
                    className="mt-1"
                  />
                  <span>
                    <span className="text-sm text-white">{s.label}</span>
                    <span className="block text-xs text-white/50">{s.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {cfg.source === 'facts' && (
            <div>
              <Label className="text-white">Facts about your business (one per line)</Label>
              <textarea
                rows={5}
                defaultValue={factsText}
                onBlur={(e) => setCfg({ factsText: e.target.value })}
                placeholder={
                  'Family-owned since 1998.\nWe use only locally-sourced ingredients.\nAsk about our loyalty discount!'
                }
                className="mt-1 w-full rounded border border-gray-700 bg-gray-800 p-2 text-sm text-white"
              />
              <p className="mt-1 text-xs text-white/50">
                Leave blank and the dog will mention your services instead.
              </p>
            </div>
          )}

          <p className="rounded border border-white/10 bg-neutral-900/40 p-2 text-xs text-white/50">
            The daily-quote option shows a fresh inspirational quote each day. Won’t show while
            you’re editing.
          </p>
        </div>
      )}
    </Collapsible>
  );
}
