'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/admin/lib/supabaseClient';
import type { Template } from '@/types/template';
import { Switch } from '@/components/ui/switch';
import debounce from 'lodash.debounce';

type TemplateSettingsPanelProps = {
  template: Template;
  onChange: (updated: Template) => void;
};

export default function TemplateSettingsPanel({ template, onChange }: TemplateSettingsPanelProps) {
  const [industries, setIndustries] = useState<string[]>([]);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugLocked, setIsSlugLocked] = useState(false);

  const colorSchemes = [
    { name: 'blue', hex: '#3b82f6' },
    { name: 'green', hex: '#22c55e' },
    { name: 'yellow', hex: '#eab308' },
    { name: 'red', hex: '#ef4444' },
  ];
  const themes = ['dark', 'light'];
  const brands = ['blue', 'green', 'red'];

  useEffect(() => {
    supabase
      .from('industries')
      .select('name')
      .then(({ data }) => {
        if (data) setIndustries(data.map((i) => i.name));
      });
  }, []);

  // Auto-generate slug from name unless locked or manually edited
  useEffect(() => {
    if (!slugManuallyEdited && !isSlugLocked && template.template_name) {
      const slug = template.template_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      onChange({ ...template, slug });
    }
  }, [template.template_name]);

  // Debounced slug check
  const checkSlugUniqueness = debounce(async (slug: string) => {
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
  }, 400);

  // Slug validation
  useEffect(() => {
    const slug = template.slug || '';
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

    if (!slug) {
      setSlugError('Slug is required');
      return;
    } else if (!slugRegex.test(slug)) {
      setSlugError(
        'Slug must be lowercase, alphanumeric, and hyphen-separated (e.g. towing-service)'
      );
      return;
    }

    checkSlugUniqueness(slug);
  }, [template.slug]);

  const handleTogglePublished = () => {
    onChange({ ...template, published: !template.published });
  };

  return (
    <div className="grid md:grid-cols-2 gap-4 rounded p-3">
      {/* Template Name */}
      <div className="md:col-span-2">
        <Label>Template Name</Label>
        <Input
          value={template.template_name || ''}
          onChange={(e) => onChange({ ...template, template_name: e.target.value })}
          placeholder="e.g. Towing Starter"
          className="bg-gray-800 text-white border border-gray-700"
        />
      </div>

      {/* Slug */}
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
            onChange({ ...template, slug: e.target.value });
          }}
          placeholder="e.g. towing-starter"
          className={`bg-gray-800 text-white border ${
            slugError ? 'border-red-500' : 'border-gray-700'
          }`}
        />
        {isCheckingSlug && (
          <p className="text-sm text-yellow-400">Checking slug availability...</p>
        )}
        {slugError && (
          <p className="text-sm text-red-400">{slugError}</p>
        )}

        {/* ✅ Live preview of public URL */}
        {template.slug && !slugError && (
          <p className="text-sm text-muted-foreground pt-1">
            URL Preview: <code>https://quicksites.ai/templates/{template.slug}</code>
          </p>
        )}
      </div>

      {/* ✅ Published Toggle */}
      <div className="md:col-span-2 flex justify-between items-center py-2 border-t border-white/10 mt-2">
        <Label>Status</Label>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Published</span>
          <Switch checked={!!template.published} onCheckedChange={handleTogglePublished} />
        </div>
      </div>

      {/* ✅ Share Link */}
      {template.slug && !slugError && (
        <div className="md:col-span-2 flex justify-between items-center pt-2">
          <Label>Share Link</Label>
          <button
            onClick={() => {
              navigator.clipboard.writeText(`https://quicksites.ai/templates/${template.slug}`);
            }}
            className="text-sm text-blue-400 hover:text-blue-300 underline"
          >
            Copy https://quicksites.ai/templates/{template.slug}
          </button>
        </div>
      )}

      {/* ✅ Archive Toggle */}
      <div className="md:col-span-2 flex justify-between items-center py-2 border-t border-white/10 mt-2">
        <Label>Archive</Label>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Archived</span>
          <Switch
            checked={!!template.archived}
            onCheckedChange={(val) => {
              onChange({
                ...template,
                archived: val,
                published: val ? false : template.published, // auto-unpublish on archive
              });
            }}
          />

          {template.archived && (
            <div className="md:col-span-2">
              <p className="text-sm text-yellow-400">⚠ This template is currently archived.</p>
            </div>
          )}
        </div>
      </div>

      {/* Rest of settings */}
      <div>
        <Label>Industry</Label>
        <select
          value={template.industry || ''}
          onChange={(e) => onChange({ ...template, industry: e.target.value })}
          className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
        >
          <option value="">Select Industry</option>
          {industries.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Layout</Label>
        <Input
          value={template.layout || ''}
          onChange={(e) => onChange({ ...template, layout: e.target.value })}
          className="bg-gray-800 text-white border border-gray-700"
        />
      </div>

      <div>
        <Label>Color Scheme</Label>
        <div className="flex gap-2 mt-1">
          {colorSchemes.map(({ name, hex }) => (
            <button
              key={name}
              onClick={() => onChange({ ...template, color_scheme: name })}
              className={`w-6 h-6 rounded-full border-2 ${
                template.color_scheme === name ? 'border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: hex }}
              title={name}
            />
          ))}
        </div>
      </div>

      <div>
        <Label>Theme</Label>
        <select
          value={template.theme || ''}
          onChange={(e) => onChange({ ...template, theme: e.target.value })}
          className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
        >
          <option value="">Select Theme</option>
          {themes.map((t) => (
            <option key={t} value={t}>
              {t === 'dark' ? '🌙 Dark' : '☀️ Light'}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Brand</Label>
        <select
          value={template.brand || ''}
          onChange={(e) => onChange({ ...template, brand: e.target.value })}
          className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
        >
          <option value="">Select Brand</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label>Commit Message</Label>
        <Input
          value={template.commit || ''}
          onChange={(e) => onChange({ ...template, commit: e.target.value })}
          className="bg-gray-800 text-white border border-gray-700"
        />
      </div>
    </div>
  );
}
