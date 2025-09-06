// components/admin/templates/panels/domain-panel.tsx
'use client';

import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import DomainInstructions from '@/components/admin/domain-instructions';
import type { Template } from '@/types/template';
import { supabase } from '@/lib/supabase/client';
import { Copy } from 'lucide-react';

/* -------------------- utils -------------------- */
function sanitizeSlug(base: string) {
  return String(base || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .trim();
}
function uniqueSuffix() {
  return Math.random().toString(36).slice(2, 6);
}
function randomSlug(base: string) {
  const s = sanitizeSlug(base || 'site');
  return s ? `${s}-${uniqueSuffix()}` : `site-${uniqueSuffix()}`;
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    /* no-op */
  }
}

/* -------------------- component -------------------- */

export default function DomainPanel({
  template,
  /** If omitted we infer from template.is_site */
  isSite: isSiteProp,
  /** Optional: needed to actually change slug (kept optional so old callers still compile) */
  onChange,
}: {
  template: Template;
  isSite?: boolean;
  onChange?: (patch: Partial<Template>) => void;
}) {
  const doChange = onChange ?? (() => {});

  /* ---- Slug editor state ---- */
  const siteTitle = useMemo(
    () => String((template?.data as any)?.meta?.siteTitle ?? template?.template_name ?? ''),
    [template]
  );

  const [locked, setLocked] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(
    () => Boolean(template.slug && template.slug !== 'untitled')
  );
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggest slug from siteTitle when not locked or manually edited
  useEffect(() => {
    if (!onChange) return; // read-only mode if no onChange supplied
    if (!locked && !manuallyEdited) {
      const suggested = sanitizeSlug(siteTitle);
      if (suggested && suggested !== template.slug) {
        doChange({ slug: suggested });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteTitle, locked, manuallyEdited]);

  // Validate + check uniqueness (debounced)
  useEffect(() => {
    const slug = template.slug || '';
    const rx = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    if (!slug) {
      setError('Slug is required');
      return;
    }
    if (!rx.test(slug)) {
      setError('Slug must be lowercase letters, numbers and dashes (e.g. roof-cleaning)');
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        setChecking(true);
        // Check in templates (excluding current id)
        const { data: tHits } = await supabase
          .from('templates')
          .select('id')
          .eq('slug', slug)
          .neq('id', template.id);

        // Check in sites (slug uniqueness for live sites)
        const { data: sHits } = await supabase.from('sites').select('id').eq('slug', slug);

        const taken = (tHits?.length ?? 0) > 0 || (sHits?.length ?? 0) > 0;
        if (taken) {
          const fix = `${slug}-${uniqueSuffix()}`;
          setError(`Slug is taken. Suggested: ${fix}`);
        } else {
          setError(null);
        }
      } catch {
        setError(null); // best-effort only; ignore RLS/hard errors
      } finally {
        setChecking(false);
      }
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.slug, template.id]);

  /* ---- URL previews ---- */
  const isSite = isSiteProp ?? !!(template as any)?.is_site;
  const slug = String(template.slug || '').trim();
  const defaultSubdomain = slug ? `${slug}.quicksites.ai` : 'your-subdomain.quicksites.ai';

  const prodPreview = isSite
    ? `https://${defaultSubdomain}`
    : `https://quicksites.ai/templates/${slug || 'slug'}`;

  // Helpful dev URLs (only shown if we can detect localhost)
  const isDevHost =
    typeof window !== 'undefined' &&
    /(^|\.)(localhost|127\.0\.0\.1|lvh\.me|nip\.io)$/i.test(window.location.hostname);

  const port = typeof window !== 'undefined' ? window.location.port || '3000' : '3000';
  const devSubdomain = slug ? `http://${slug}.localhost:${port}/` : '';
  const devPath = slug ? `http://localhost:${port}/sites/${slug}` : '';

  const customDomain =
    (template as any)?.custom_domain ||
    (template as any)?.domain ||
    '';

  // Hooks for existing toolbar/panel events
  const openVersionsMenu = () => {
    try {
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

  const isPublished = Boolean((template as any)?.published);

  return (
    <Collapsible title="URL, Publishing & Domain" id="publishing-domain">
      <div className="space-y-6">

        {/* -------------------- Slug editor -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3">
          <div className="flex justify-between items-center mb-2">
            <Label>Slug</Label>
            <div className="flex gap-2 items-center text-sm text-muted-foreground">
              <span>Lock Slug</span>
              <Switch
                checked={locked}
                onCheckedChange={(v) => setLocked(v)}
                disabled={isPublished || !onChange}
              />
            </div>
          </div>

          <Input
            value={template.slug || ''}
            disabled={isPublished || !onChange}
            onChange={(e) => {
              if (!onChange) return;
              const normalized = sanitizeSlug(e.target.value);
              setManuallyEdited(true);
              doChange({ slug: normalized });
            }}
            placeholder="e.g. roof-cleaning"
            className={`bg-gray-800 text-white border ${
              error ? 'border-red-500' : 'border-gray-700'
            }`}
          />

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                if (!onChange) return;
                const unique = randomSlug(siteTitle || 'site');
                setManuallyEdited(true);
                doChange({ slug: unique });
              }}
              className="text-xs text-blue-400 underline disabled:opacity-50"
              disabled={!onChange}
            >
              Generate Random Slug
            </button>
            <button
              type="button"
              onClick={() => {
                if (!onChange) return;
                const suggested = sanitizeSlug(siteTitle || '');
                setManuallyEdited(false);
                doChange({ slug: suggested });
              }}
              className="text-xs text-gray-400 underline disabled:opacity-50"
              disabled={!onChange}
            >
              Reset to Suggested
            </button>

            {error?.startsWith('Slug is taken') && onChange && (
              <button
                type="button"
                onClick={() => {
                  const suggestion = error.split(':').pop()?.trim() || randomSlug(siteTitle);
                  doChange({ slug: suggestion });
                  setManuallyEdited(true);
                  setError(null);
                }}
                className="text-xs text-amber-400 underline"
              >
                Use Suggestion
              </button>
            )}
          </div>

          {checking && <p className="text-sm text-yellow-400 mt-2">Checking slug availability…</p>}
          {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
        </div>

        {/* -------------------- URL preview & copies -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-sm text-white/90">
          <Label className="block text-xs text-white/70 mb-1">Live URL (production style)</Label>
          <div className="flex items-center gap-2">
            <code className="rounded bg-neutral-950/70 px-2 py-1">{prodPreview}</code>
            <Button size="sm" variant="outline" onClick={() => copy(prodPreview)}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </div>

          {isDevHost && slug && (
            <div className="mt-3 grid gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs text-white/70 w-28">Dev subdomain</Label>
                <code className="rounded bg-neutral-950/70 px-2 py-1">{devSubdomain}</code>
                <Button size="sm" variant="outline" onClick={() => copy(devSubdomain)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs text-white/70 w-28">Dev path</Label>
                <code className="rounded bg-neutral-950/70 px-2 py-1">{devPath}</code>
                <Button size="sm" variant="outline" onClick={() => copy(devPath)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
            </div>
          )}

          {!isSite && (
            <p className="mt-2 text-xs text-white/60">
              This template isn’t published as a site yet. Use the <strong>Versions</strong> menu (bottom toolbar) to
              create a snapshot and publish.
            </p>
          )}
        </div>

        {/* -------------------- Workflow steps -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-sm">
          <Label className="block text-xs text-white/70 mb-2">How to go live</Label>
          <ol className="list-decimal list-inside space-y-1 text-white/90">
            <li><strong>Save</strong> your edits (autosave runs automatically).</li>
            <li>
              Open the <strong>Versions</strong> menu (bottom toolbar) → <em>Create snapshot</em>{' '}
              <span className="text-white/60">(captures the current draft)</span>.
              {' '}
              <Button size="sm" variant="ghost" className="ml-1 h-7 px-2" onClick={openVersionsMenu}>
                Open Versions
              </Button>
            </li>
            <li>In <strong>Versions</strong>, select the snapshot → <em>Publish</em>.</li>
            <li>
              Visit your live subdomain:{' '}
              <code className="rounded bg-neutral-950/70 px-1 py-0.5">{`https://${defaultSubdomain}`}</code>.
            </li>
            <li>(Optional) Connect a <strong>custom domain</strong> following the DNS instructions below.</li>
          </ol>
        </div>

        {/* -------------------- Domain instructions -------------------- */}
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

        {/* -------------------- Helpful notes -------------------- */}
        <div className="rounded-lg border border-white/10 bg-neutral-900/50 p-3 text-xs text-white/60 leading-relaxed">
          <ul className="list-disc list-inside space-y-1">
            <li>Publishing is snapshot-based. The live site always reads from a snapshot, not your mutable draft.</li>
            <li>
              After publishing, SEO and share images are generated from your current metadata. Update title/description in
              <em> Identity</em> or your SEO panel as needed.
            </li>
            <li>Favicon and logo live in <code>data.meta</code> (set via the Header/Identity panels).</li>
          </ul>
        </div>
      </div>
    </Collapsible>
  );
}
