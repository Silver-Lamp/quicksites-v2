// components/admin/templates/panels/slug-panel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { Template } from '@/types/template';

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
const rxSlug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export default function SlugPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (patch: Partial<Template>) => void;
}) {
  // Meta-first title for slug suggestion
  const siteTitle = useMemo(
    () => String((template?.data as any)?.meta?.siteTitle ?? template?.template_name ?? ''),
    [template]
  );

  const [locked, setLocked] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(
    () => Boolean(template.slug && template.slug !== 'untitled')
  );

  const [slugLocal, setSlugLocal] = useState<string>(String(template.slug || ''));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastSavedAtRef = useRef<number>(0);
  const lastRequestedSlugRef = useRef<string | null>(null);
  const inFlightRef = useRef(false);

  // Keep local field in sync with server unless we *just* saved
  useEffect(() => {
    const justSaved = Date.now() - lastSavedAtRef.current < 5000;
    if (!justSaved) setSlugLocal(String(template.slug || ''));
  }, [template.id, template.slug]);

  // Suggest slug from siteTitle when not locked or manually edited and field empty
  useEffect(() => {
    if (!locked && !manuallyEdited && !slugLocal) {
      const suggested = sanitizeSlug(siteTitle);
      if (suggested && suggested !== template.slug) {
        setSlugLocal(suggested);
        onChange({ slug: suggested }); // local reflect only; server save happens via PATCH below
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteTitle, locked, manuallyEdited]);

  const isSite = !!(template as any)?.is_site;
  const urlPreview = isSite
    ? `https://${(slugLocal || 'your-subdomain')}.quicksites.ai`
    : `https://quicksites.ai/templates/${slugLocal || 'slug'}`;

  async function saveSlug(current: string) {
    const slug = (current || '').trim();

    if (!slug) return setError('Slug is required');
    if (!rxSlug.test(slug)) {
      return setError('Slug must be lowercase letters, numbers and dashes (e.g. roof-cleaning)');
    }
    if (inFlightRef.current) return;
    if (slug === lastRequestedSlugRef.current) return; // ignore duplicates

    setError(null);
    setSaving(true);
    inFlightRef.current = true;
    lastRequestedSlugRef.current = slug;

    try {
      const res = await fetch(`/api/templates/${template.id}/slug`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      const json = await res.json();
      if (!res.ok) {
        // surface precise server message (uniqueness, published, guard, etc.)
        setError(json?.error || 'Failed to save slug');
        return;
      }

      // Success — keep local authoritative for a short window to avoid hydrate flicker
      lastSavedAtRef.current = Date.now();
      setSlugLocal(json.slug);
      onChange({ slug: json.slug }); // reflect upwards (other fields ignore slug on commit)
    } catch (e: any) {
      setError(e?.message || 'Failed to save slug');
    } finally {
      setSaving(false);
      inFlightRef.current = false;
      // allow another identical click a moment later
      setTimeout(() => {
        if (lastRequestedSlugRef.current === slug) lastRequestedSlugRef.current = null;
      }, 1500);
    }
  }

  return (
    <Collapsible title="URL & Slug Settings" id="url-slug-settings">
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label>Slug</Label>
          <div className="flex gap-2 items-center text-sm text-muted-foreground">
            <span>Lock Slug</span>
            <Switch
              checked={locked}
              onCheckedChange={(v) => setLocked(v)}
              disabled={template.published}
            />
          </div>
        </div>

        <Input
          value={slugLocal}
          disabled={template.published}
          onChange={(e) => {
            const normalized = sanitizeSlug(e.target.value);
            setManuallyEdited(true);
            setSlugLocal(normalized); // local only; no network while typing
          }}
          onKeyDown={(e) => {
            if (!template.published && e.key === 'Enter') {
              e.preventDefault();
              void saveSlug(slugLocal);
            }
          }}
          placeholder="e.g. roof-cleaning"
          className={`bg-gray-800 text-white border ${error ? 'border-red-500' : 'border-gray-700'}`}
        />

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              const unique = randomSlug(siteTitle || 'site');
              setManuallyEdited(true);
              setSlugLocal(unique);
            }}
            className="text-xs text-blue-400 underline"
            disabled={template.published}
          >
            Generate Random Slug
          </button>
          <button
            type="button"
            onClick={() => {
              const suggested = sanitizeSlug(siteTitle || '');
              setManuallyEdited(false);
              setSlugLocal(suggested);
            }}
            className="text-xs text-gray-400 underline"
            disabled={template.published}
          >
            Reset to Suggested
          </button>

          <button
            type="button"
            onClick={() => void saveSlug(slugLocal)}
            className="text-xs underline"
            disabled={template.published || saving}
            title="Validate & save slug"
          >
            {saving ? 'Saving…' : 'Check & Save'}
          </button>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        {slugLocal && !error && (
          <p className="text-sm text-muted-foreground pt-1">
            URL Preview: <code>{urlPreview}</code>
          </p>
        )}
      </div>
    </Collapsible>
  );
}
