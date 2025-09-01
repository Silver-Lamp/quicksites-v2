// components/admin/templates/panels/domain-panel.tsx
'use client';

import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import DomainInstructions from '@/components/admin/domain-instructions';
import { Button } from '@/components/ui/button';
import type { Template } from '@/types/template';
import * as React from 'react';
import { Copy } from 'lucide-react';

/**
 * Domain & Publishing panel
 *
 * This panel is informational and dispatches UI events only.
 * Publishing (create snapshot → publish) is handled via the bottom toolbar
 * “Versions” menu and the centralized commit/snapshot/publish pipeline.
 */
export default function DomainPanel({
  template,
  isSite,
}: {
  template: Template;
  isSite: boolean;
  // NOTE: no onChange here — this panel doesn’t write directly
}) {
  const slug = String(template.slug || '').trim();
  const defaultSubdomain = slug ? `${slug}.quicksites.ai` : 'your-subdomain.quicksites.ai';
  const customDomain =
    (template as any)?.custom_domain ||
    (template as any)?.domain ||
    '';

  const baseUrlPreview = isSite
    ? `https://${defaultSubdomain}`
    : `https://quicksites.ai/templates/${slug || 'slug'}`;

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // no-op
    }
  };

  // Helper to nudge the editor to open the Versions menu / Identity panel
  const openVersionsMenu = () => {
    try {
      // If your toolbar listens for this, it can open the Versions dropdown.
      // Otherwise, this is a no-op and the instructions still guide users.
      window.dispatchEvent(new CustomEvent('qs:versions:open'));
    } catch {}
  };
  const openIdentityPanel = () => {
    try {
      window.dispatchEvent(new CustomEvent('qs:settings:set-open', { detail: true }));
      window.dispatchEvent(
        new CustomEvent('qs:open-settings-panel', {
          detail: { panel: 'identity', openEditor: true, scroll: true, spotlightMs: 900 } as any,
        }),
      );
    } catch {}
  };

  return (
    <Collapsible title="Publishing & Domain" id="publishing-domain">
      <div className="space-y-4">

        {/* Live URL preview */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-sm text-white/90">
          <Label className="block text-xs text-white/70 mb-1">Preview URL</Label>
          <div className="flex items-center gap-2">
            <code className="rounded bg-neutral-950/70 px-2 py-1">{baseUrlPreview}</code>
            <Button size="sm" variant="outline" onClick={() => copy(baseUrlPreview)}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </div>
          {!isSite && (
            <p className="mt-2 text-xs text-white/60">
              This template isn’t published as a site yet. Use the <strong>Versions</strong> menu (bottom toolbar) to
              create a snapshot and publish.
            </p>
          )}
        </div>

        {/* Workflow steps */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-sm">
          <Label className="block text-xs text-white/70 mb-2">How to go live</Label>
          <ol className="list-decimal list-inside space-y-1 text-white/90">
            <li>
              <strong>Save</strong> your edits (autosave runs automatically).
            </li>
            <li>
              Open the <strong>Versions</strong> menu (bottom toolbar) → <em>Create snapshot</em>{' '}
              <span className="text-white/60">(captures the current draft)</span>.
              {' '}
              <Button size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={openVersionsMenu}>
                Open Versions
              </Button>
            </li>
            <li>
              In <strong>Versions</strong>, select the snapshot → <em>Publish</em>.
            </li>
            <li>
              Visit your live subdomain:{' '}
              <code className="rounded bg-neutral-950/70 px-1 py-0.5">{`https://${defaultSubdomain}`}</code>.
            </li>
            <li>
              (Optional) Connect a <strong>custom domain</strong> following the DNS instructions below.
            </li>
          </ol>
        </div>

        {/* Domain instructions */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
          <Label className="block text-xs text-white/70 mb-2">Custom Domain</Label>
          <p className="text-sm text-white/80 mb-2">
            Point your domain to your live site. If you haven’t already set your business address, open{' '}
            <button
              type="button"
              onClick={openIdentityPanel}
              className="underline text-blue-300 hover:text-blue-200"
              title="Open Template Identity"
            >
              Template Identity
            </button>{' '}
            to set your contact info and branding.
          </p>
          <DomainInstructions domain={customDomain} />
          {!customDomain && (
            <p className="mt-2 text-xs text-white/60">
              If you don’t have a custom domain yet, you can stay on{' '}
              <code className="rounded bg-neutral-950/70 px-1 py-0.5">{defaultSubdomain}</code>.
            </p>
          )}
        </div>

        {/* Helpful notes */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-xs text-white/60 leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            <li>
              Publishing is snapshot-based. The live site always reads from a snapshot, not your mutable draft.
            </li>
            <li>
              After publishing, SEO and share images are generated from your current metadata. Update title/description in
              <em> Identity</em> or your SEO panel as needed.
            </li>
            <li>
              Favicon and logo live in <code>data.meta</code> (set via the Header/Identity panels). No changes are required here.
            </li>
          </ul>
        </div>
      </div>
    </Collapsible>
  );
}
