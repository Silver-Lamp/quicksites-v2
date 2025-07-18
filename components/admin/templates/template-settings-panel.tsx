'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/admin/lib/supabaseClient';
import type { Template } from '@/types/template';
import { Switch } from '@/components/ui/switch';
import debounce from 'lodash.debounce';
import { toast } from 'react-hot-toast';
import { SiteTheme, useTheme } from '@/hooks/useThemeContext';
import { getFontClasses } from '@/lib/theme/getFontClasses';
import { ThemePreviewCard } from '@/components/admin/theme-preview-card';
import clsx from 'clsx';

type TemplateSettingsPanelProps = {
  template: Template;
  onChange: (updated: Template) => void;
};

const fonts = ['sans', 'serif', 'mono', 'cursive'];
const radii = ['sm', 'md', 'lg', 'xl', 'full'];
const modes = ['light', 'dark'];

const defaultTheme = {
  glow: [],
  fontFamily: 'sans',
  borderRadius: 'lg',
  accentColor: 'indigo-600',
  darkMode: 'dark',
};

export default function TemplateSettingsPanel({ template, onChange }: TemplateSettingsPanelProps) {
  const [industries, setIndustries] = useState<string[]>([]);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [isCheckingSlug, setIsCheckingSlug] = useState(false);
  const [isSlugLocked, setIsSlugLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'theme'>('general');

  const { setTheme } = useTheme();
  const isSite = template.is_site;

  useEffect(() => {
    supabase
      .from('industries')
      .select('name')
      .then(({ data }) => {
        if (data) setIndustries(data.map((i) => i.name));
      });
  }, []);

  useEffect(() => {
    if (!slugManuallyEdited && !isSlugLocked && template.template_name) {
      const slug = template.template_name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      onChange({ ...template, slug });
    }
  }, [template.template_name]);

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

  const handleTogglePublished = async (value: boolean) => {
    const updated = { ...template, published: value };
    onChange(updated);
    const { error } = await supabase
      .from('templates')
      .update({ published: value })
      .eq('id', template.id);

    if (error) {
      toast.error('Failed to update publish status');
      onChange({ ...template, published: !value });
    } else {
      toast.success(value ? 'Template published' : 'Template unpublished');
    }
  };

  const handleResetTheme = () => {
    setTheme(defaultTheme as SiteTheme);
    onChange({ ...template, theme: defaultTheme.fontFamily });
  };

  return (
    <div className="rounded p-3 space-y-4">
      <div className="flex gap-2 text-sm font-medium border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('general')}
          className={clsx('px-3 py-1 rounded', activeTab === 'general' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-300')}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('theme')}
          className={clsx('px-3 py-1 rounded', activeTab === 'theme' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-300')}
        >
          Design
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Template Name</Label>
            <Input
              value={template.template_name || ''}
              onChange={(e) => onChange({ ...template, template_name: e.target.value })}
              placeholder="e.g. Towing Starter"
              className="bg-gray-800 text-white border border-gray-700"
            />
          </div>

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

          <div className="md:col-span-2 flex justify-between items-center py-2 border-t border-white/10 mt-2">
            <Label>Status</Label>
            <div className="flex gap-2 items-center">
              <span className="text-sm text-muted-foreground">Publish {isSite ? 'Site' : 'Template'}</span>
              <Switch
                checked={!!template.published}
                onCheckedChange={handleTogglePublished}
              />
            </div>
          </div>
        </div>
      )}

      {activeTab === 'theme' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Font</Label>
              <select
                value={template.theme || ''}
                onChange={(e) => {
                  const font = e.target.value;
                  onChange({ ...template, theme: font });
                  setTheme({ glow: [], fontFamily: font });
                }}
                className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
              >
                <option value="">Default</option>
                {fonts.map((f) => {
                  const label = f === 'sans' ? 'Inter' : f === 'serif' ? 'Roboto Slab' : f === 'mono' ? 'Fira Code' : 'Pacifico';
                  const fontStyle = getFontClasses({ fontFamily: f, glow: [] }).css;
                  return (
                    <option key={f} value={f} style={{ fontFamily: fontStyle }}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <Label>Border Radius</Label>
              <select
                onChange={(e) => setTheme({ glow: [], fontFamily: template.theme || 'sans', borderRadius: e.target.value })}
                className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
              >
                {radii.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div>
              <Label>Accent Color</Label>
              <Input
                placeholder="e.g. indigo-600"
                onBlur={(e) => setTheme({ glow: [], fontFamily: template.theme || 'sans', accentColor: e.target.value })}
                className="bg-gray-800 text-white border border-gray-700"
              />
            </div>

            <div>
              <Label>Dark Mode</Label>
              <select
                onChange={(e) => setTheme({ glow: [], fontFamily: template.theme || 'sans', darkMode: e.target.value as 'dark' | 'light' })}
                className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded mt-1"
              >
                {modes.map((m) => (
                  <option key={m} value={m}>
                    {m === 'dark' ? '🌙 Dark' : '☀ Light'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <ThemePreviewCard />

          <div className="flex gap-4 pt-2">
            <button
              onClick={handleResetTheme}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded"
            >
              Reset Theme
            </button>
            <button
              onClick={() => toast.success('🚧 Save as preset coming soon')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded"
            >
              Save as Preset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
