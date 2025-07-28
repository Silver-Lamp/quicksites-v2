'use client';

import { useEffect, useState, useRef } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/admin/lib/supabaseClient';
import type { Template } from '@/types/template';

function generateSlug(base: string) {
  return base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .trim();
}

function generateUniqueSuffix() {
  return Math.random().toString(36).slice(2, 6);
}

function generateUniqueSlug(base: string) {
  return `${generateSlug(base)}-${generateUniqueSuffix()}`;
}

export default function SlugPanel({
  template,
  onChange,
}: {
  template: Template;
  onChange: (updated: Template) => void;
}) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(() =>
    template.slug && template.slug !== 'untitled'
  );
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugLocked, setIsSlugLocked] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Suggest slug on template name change
  useEffect(() => {
    if (!slugManuallyEdited && !isSlugLocked && template.template_name) {
      const generated = generateSlug(template.template_name);
      onChange({ ...template, slug: generated });
    }
  }, [template.template_name, isSlugLocked, slugManuallyEdited]);

  // Debounced slug validation
  useEffect(() => {
    const slug = template.slug || '';
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    if (!slug) {
      setSlugError('Slug is required');
      return;
    } else if (!slugRegex.test(slug)) {
      setSlugError(
        'Slug must be lowercase, alphanumeric, and hyphen-separated (e.g. roof-cleaning)'
      );
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => checkSlugUniqueness(slug), 500);
  }, [template.slug]);

  const checkSlugUniqueness = async (slug: string) => {
    setIsCheckingSlug(true);
    const { data } = await supabase
      .from('templates')
      .select('id')
      .eq('slug', slug)
      .neq('id', template.id);

    if (data && data.length > 0) {
      const fixedSlug = `${slug}-${generateUniqueSuffix()}`;
      setSlugError(`Slug taken. Suggested: ${fixedSlug}`);
      onChange({ ...template, slug: fixedSlug });
    } else {
      setSlugError(null);
    }

    setIsCheckingSlug(false);
  };

  const isSite = template.is_site;
  const baseUrl = isSite
    ? `https://${template.slug || 'yourdomain'}.quicksites.ai`
    : `https://quicksites.ai/templates/${template.slug || 'slug'}`;

  return (
    <Collapsible title="URL & Slug Settings" id="url-slug-settings">
      <div className="md:col-span-2 space-y-1">
        <div className="flex justify-between items-center">
          <Label>Slug</Label>
          <div className="flex gap-2 items-center text-sm text-muted-foreground">
            <span>Lock Slug</span>
            <Switch
              checked={isSlugLocked}
              onCheckedChange={(val) => setIsSlugLocked(val)}
              disabled={template.published}
            />
          </div>
        </div>

        <Input
          value={template.slug || ''}
          disabled={template.published}
          onChange={(e) => {
            const normalized = generateSlug(e.target.value);
            setSlugManuallyEdited(true);
            onChange({ ...template, slug: normalized });
          }}
          placeholder="e.g. roof-cleaning"
          className={`bg-gray-800 text-white border ${
            slugError ? 'border-red-500' : 'border-gray-700'
          }`}
        />

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              const unique = generateUniqueSlug(template.template_name || 'site');
              setSlugManuallyEdited(true);
              onChange({ ...template, slug: unique });
            }}
            className="text-xs text-blue-400 underline"
          >
            Generate Random Slug
          </button>
          <button
            type="button"
            onClick={() => {
              const suggested = generateSlug(template.template_name || '');
              setSlugManuallyEdited(false);
              onChange({ ...template, slug: suggested });
            }}
            className="text-xs text-gray-400 underline"
          >
            Reset to Suggested
          </button>
        </div>

        {isCheckingSlug && (
          <p className="text-sm text-yellow-400">Checking slug availability...</p>
        )}
        {slugError && <p className="text-sm text-red-400">{slugError}</p>}
        {template.slug && !slugError && (
          <p className="text-sm text-muted-foreground pt-1">
            URL Preview: <code>{baseUrl}</code>
          </p>
        )}
      </div>
    </Collapsible>
  );
}
