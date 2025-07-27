// File: panels/SlugPanel.tsx

import { useEffect, useState } from 'react';
import Collapsible from '@/components/ui/collapsible-panel';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/admin/lib/supabaseClient';
import type { Template } from '@/types/template';

export default function SlugPanel({ template, onChange }: { template: Template; onChange: (updated: Template) => void }) {
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugLocked, setIsSlugLocked] = useState(false);

  useEffect(() => {
    if (!slugManuallyEdited && !isSlugLocked && template.template_name) {
      const slug = template.template_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      onChange({ ...template, slug });
    }
  }, [template.template_name]);

  useEffect(() => {
    const slug = template.slug || '';
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    if (!slug) {
      setSlugError('Slug is required');
      return;
    } else if (!slugRegex.test(slug)) {
      setSlugError('Slug must be lowercase, alphanumeric, and hyphen-separated (e.g. towing-service)');
      return;
    }

    checkSlugUniqueness(slug);
  }, [template.slug]);

  const checkSlugUniqueness = async (slug: string) => {
    setIsCheckingSlug(true);
    const { data } = await supabase
      .from('templates')
      .select('id')
      .eq('slug', slug)
      .neq('id', template.id);

    if (data && data.length > 0) {
      setSlugError('Slug is already in use');
    } else {
      setSlugError(null);
    }

    setIsCheckingSlug(false);
  };

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
          disabled={template.published || !slugManuallyEdited}
          onChange={(e) => {
            setSlugManuallyEdited(true);
            const normalized = e.target.value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .trim();
onChange({ ...template, slug: normalized });
          }}
          placeholder="e.g. towing-starter"
          className={`bg-gray-800 text-white border ${slugError ? 'border-red-500' : 'border-gray-700'}`}
        />
        {isCheckingSlug && <p className="text-sm text-yellow-400">Checking slug availability...</p>}
        {slugError && <p className="text-sm text-red-400">{slugError}</p>}
        {template.slug && !slugError && (
          <p className="text-sm text-muted-foreground pt-1">
            URL Preview: <code>https://quicksites.ai/templates/{template.slug}</code>
          </p>
        )}
      </div>
    </Collapsible>
  );
}
