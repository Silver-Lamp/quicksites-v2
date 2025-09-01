// components/admin/templates/block-editors/services-editor.tsx
'use client';

import * as React from 'react';
import type { Block } from '@/types/blocks';
import type { BlockEditorProps } from './index';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

function normList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((s) => String(s ?? '').trim()).filter(Boolean)));
}

function getServices(template?: any): string[] {
  // Canonical first → optional top-level mirror → legacy block content fallback
  return (
    normList(template?.data?.services) ||
    normList(template?.services) ||
    []
  );
}

export default function ServicesEditor({
  block,
  onSave,
  onClose,
  template,
}: BlockEditorProps) {
  const services = getServices(template);

  // Open sidebar & try to focus the Services panel (if supported)
  const openServicesPanel = React.useCallback(() => {
    try {
      // Ensure sidebar is open
      window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: true }));
      // Ask the sidebar to scroll/spotlight its Services panel (it may ignore unknown panels gracefully)
      window.dispatchEvent(
        new CustomEvent('qs:open-settings-panel', {
          detail: { panel: 'services', openEditor: true, scroll: true, spotlightMs: 900 } as any,
        })
      );
    } catch {}
  }, []);

  return (
    <div className="p-4 space-y-5 text-white">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">Services</h3>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onClose}>Close</Button>
          {/* Call onSave with the original block so callers keep their standard flow */}
          <Button onClick={() => { onSave?.(block); onClose?.(); }}>Done</Button>
        </div>
      </div>

      <div className="rounded-lg border border-white/10 bg-neutral-900/60 p-3">
        <p className="text-sm text-white/80">
          This block renders from <code>template.data.services</code>. To edit services (and use AI suggestions),
          open the <strong>Sidebar → Services</strong> panel.
        </p>
        <div className="mt-3">
          <Button onClick={openServicesPanel}>Open Services Panel</Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-white/90">Preview</Label>
        {services.length ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            {services.map((s, i) => (
              <li key={`${i}-${s}`} className="list-disc list-inside text-white/90">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-white/60 rounded border border-white/10 bg-neutral-900/40 p-3">
            No services configured yet. Click <em>Open Services Panel</em> to add them.
          </div>
        )}
      </div>

      <div className="text-xs text-white/60">
        Tip: Services are used by Services blocks and forms across the site, so editing them in the sidebar
        keeps everything in sync.
      </div>
    </div>
  );
}
