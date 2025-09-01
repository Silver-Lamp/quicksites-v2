// components/admin/templates/panels/slug-panel.tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { Template } from '@/types/template';
import { supabase } from '@/lib/supabase/client';

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

export default function SlugPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (patch: Partial<Template>) => void; // PATCH (parent autosaves via commit)
}) {
  // Meta-first title for slug suggestion
  const siteTitle = useMemo(
    () => String((template?.data as any)?.meta?.siteTitle ?? template?.template_name ?? ''),
    [template]
  );

  const [locked, setLocked] = useState(false);
  const [manuallyEdited, setManuallyEdited] = useState(() => Boolean(template.slug && template.slug !== 'untitled'));
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Suggest slug from siteTitle when not locked or manually edited
  useEffect(() => {
    if (!locked && !manuallyEdited) {
      const suggested = sanitizeSlug(siteTitle);
      if (suggested && suggested !== template.slug) {
        onChange({ slug: suggested });
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

    // Debounce: check both templates and sites (best-effort hint)
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
        const { data: sHits } = await supabase
          .from('sites')
          .select('id')
          .eq('slug', slug);

        const taken = (tHits?.length ?? 0) > 0 || (sHits?.length ?? 0) > 0;
        if (taken) {
          const fix = `${slug}-${uniqueSuffix()}`;
          setError(`Slug is taken. Suggested: ${fix}`);
        } else {
          setError(null);
        }
      } catch {
        // Best-effort only; ignore errors (RLS may hide rows)
        setError(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.slug, template.id]);

  const isSite = !!template.is_site;
  const urlPreview = isSite
    ? `https://${template.slug || 'your-subdomain'}.quicksites.ai`
    : `https://quicksites.ai/templates/${template.slug || 'slug'}`;

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
          value={template.slug || ''}
          disabled={template.published}
          onChange={(e) => {
            const normalized = sanitizeSlug(e.target.value);
            setManuallyEdited(true);
            onChange({ slug: normalized });
          }}
          placeholder="e.g. roof-cleaning"
          className={`bg-gray-800 text-white border ${
            error ? 'border-red-500' : 'border-gray-700'
          }`}
        />

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={() => {
              const unique = randomSlug(siteTitle || 'site');
              setManuallyEdited(true);
              onChange({ slug: unique });
            }}
            className="text-xs text-blue-400 underline"
          >
            Generate Random Slug
          </button>
          <button
            type="button"
            onClick={() => {
              const suggested = sanitizeSlug(siteTitle || '');
              setManuallyEdited(false);
              onChange({ slug: suggested });
            }}
            className="text-xs text-gray-400 underline"
          >
            Reset to Suggested
          </button>
          {error?.startsWith('Slug is taken') && (
            <button
              type="button"
              onClick={() => {
                const suggestion = error.split(':').pop()?.trim() || randomSlug(siteTitle);
                onChange({ slug: suggestion });
                setManuallyEdited(true);
                setError(null);
              }}
              className="text-xs text-amber-400 underline"
            >
              Use Suggestion
          </button>
          )}
        </div>

        {checking && <p className="text-sm text-yellow-400">Checking slug availability…</p>}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {template.slug && !error && (
          <p className="text-sm text-muted-foreground pt-1">
            URL Preview: <code>{urlPreview}</code>
          </p>
        )}
      </div>
    </Collapsible>
  );
}
