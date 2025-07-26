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
import DomainInstructions from '@/components/admin/domain-instructions';
import DomainStatusBadge from '@/components/admin/domain-status-badge';
import FaviconUploader from '../favicon-uploader';
import OGBulkRebuild from '../og-bulk-rebuild';
import HeadRenderer from '@/components/head/HeadRenderer';
import SeoPreviewTestLinks from '../seo-preview-test-links';
import SeoPreviewThumbnail from '../seo-preview-thumbnail';
import SeoShareCardPanel from '../seo-share-card-panel';
import SeoRescrapeButtons from '../seo-rescrape-buttons';
import Collapsible from '@/components/ui/collapsible-panel';

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

  useEffect(() => {
    if (!template.meta?.title || template.meta.title.trim() === '') {
      const heroBlock = template.data?.pages?.[0]?.content_blocks?.find((b) => b.type === 'hero');
      const businessName = extractBusinessName(template);
      const fallbackTitle =
        businessName ||
        template.template_name ||
        template.data?.pages?.[0]?.title ||
        heroBlock?.content?.headline ||
        '';
      onChange({
        ...template,
        meta: {
          ...template.meta,
          title: fallbackTitle,
        },
      });
    }
  
    if (!template.meta?.description || template.meta.description.trim() === '') {
      const heroBlock = template.data?.pages?.[0]?.content_blocks?.find((b) => b.type === 'hero');
      const fallbackDesc =
        heroBlock?.content?.subheadline || heroBlock?.content?.headline || '';
      onChange({
        ...template,
        meta: {
          ...template.meta,
          description: fallbackDesc,
        },
      });
    }
  }, []);
  
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

  function extractBusinessName(template: Template): string | null {
    const pages = template.data?.pages || [];
    for (const page of pages) {
      for (const block of page.content_blocks || []) {
        if (block.type === 'footer' && block.content?.businessName) {
          return block.content.businessName;
        }
      }
    }
    return null;
  }
  
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
    <Collapsible title="Template Identity" id="template-identity">
      <div className="md:col-span-2">
        <Label>Template Name</Label>
        <Input
          value={template.template_name || ''}
          onChange={(e) => onChange({ ...template, template_name: e.target.value })}
          placeholder="e.g. Towing Starter"
          className="bg-gray-800 text-white border border-gray-700"
        />
      </div>
      <div className="space-y-1">
        <Label>Industry</Label>
        <select
          value={template.industry || ''}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '__add_new__') {
              const newIndustry = prompt('Enter new industry name:');
              if (newIndustry?.trim()) {
                const updatedList = [...industries, newIndustry.trim()];
                setIndustries(updatedList);
                onChange({ ...template, industry: newIndustry.trim() });

                supabase.from('industries').insert({ name: newIndustry.trim() }).then(({ error }) => {
                  if (error) toast.error('Failed to save new industry');
                  else toast.success('New industry added');
                });
              }
            } else {
              onChange({ ...template, industry: value });
            }
          }}
          className="w-full bg-gray-800 text-white border border-gray-700 px-2 py-1 rounded"
        >
          <option value="">Select industry</option>
          {industries.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
          <option value="__add_new__">+ Add new industry...</option>
        </select>
      </div>
    </Collapsible>

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
    </Collapsible>

    <Collapsible title="Publishing & Domain" id="publishing-domain">
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
      <div className="flex gap-2 items-center flex-wrap">
        <DomainStatusBadge domain={template.custom_domain || ''} />
        <DomainInstructions domain={template.custom_domain || ''} />
        <FaviconUploader
          templateId={template.id}
          currentUrl={template.logo_url}
          onUpload={(url) => onChange({ ...template, logo_url: url })}
        />
        <OGBulkRebuild slug={template.slug} endpoint="/api/og/rebuild-all" onResult={() => {}} />
        <SeoPreviewTestLinks url={template.slug} />
        <SeoPreviewThumbnail pageUrl={template.slug} ogImageUrl={template.meta?.ogImage || ''} />
        <SeoShareCardPanel url={template.slug} />
      </div>
    </Collapsible>
    <Collapsible title="Verification & SEO Meta" id="verification-seo-meta">
      <div className="flex items-center justify-between py-2 border-t border-white/10 mt-2">
        <Label>Verified</Label>
        <Switch
          checked={!!template.verified}
          onCheckedChange={(val) => onChange({ ...template, verified: val })}
        />
      </div>

      <div className="space-y-3 mt-4">
        <div>
          <Label>OG Image URL</Label>
          <Input
            type="url"
            placeholder="https://example.com/og.jpg"
            value={template.meta?.ogImage || ''}
            onChange={(e) =>
              onChange({
                ...template,
                meta: { ...template.meta, ogImage: e.target.value },
              })
            }
            className="bg-gray-800 text-white border border-gray-700"
          />
          {template.meta?.ogImage && (
            <img
              src={template.meta.ogImage}
              alt="OG Preview"
              className="mt-2 rounded border border-gray-600 w-full max-w-md"
            />
          )}

          <button
            onClick={() => {
              const heroBlock = template.data?.pages?.[0]?.content_blocks?.find((b) => b.type === 'hero');
              const ogImage = heroBlock?.content?.image_url || '';
              const description = heroBlock?.content?.subheadline || heroBlock?.content?.headline || '';
              const title = template.template_name || template.data?.pages?.[0]?.title || '';
              onChange({
                ...template,
                meta: {
                  ...template.meta,
                  ogImage,
                  description,
                  title,
                },
              });
            }}
            className="mt-2 text-sm bg-blue-800 hover:bg-blue-700 text-white px-3 py-1 rounded"
          >
            Regenerate from Hero
          </button>

        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="Page Title for Social Media"
            value={template.meta?.title || ''}
            onChange={(e) =>
              onChange({
                ...template,
                meta: { ...template.meta, title: e.target.value },
              })
            }
            onBlur={(e) => {
              if (!e.target.value.trim()) {
                const heroBlock = template.data?.pages?.[0]?.content_blocks?.find((b) => b.type === 'hero');
                const businessName = extractBusinessName(template);
                const fallbackTitle =
                  businessName ||
                  template.template_name ||
                  template.data?.pages?.[0]?.title ||
                  heroBlock?.content?.headline ||
                  '';
                onChange({
                  ...template,
                  meta: { ...template.meta, title: fallbackTitle },
                });
              }
            }}
            className="bg-gray-800 text-white border border-gray-700 flex-1"
          />
          <button
            onClick={() => {
              const businessName = extractBusinessName(template);
              if (businessName) {
                onChange({ ...template, meta: { ...template.meta, title: businessName } });
              }
            }}
            className="text-sm bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
          >
            Use Business Name
          </button>
        </div>

        <div className="flex items-center gap-2">
          <Input
            placeholder="A short description for previews"
            value={template.meta?.description || ''}
            onChange={(e) =>
              onChange({
                ...template,
                meta: { ...template.meta, description: e.target.value },
              })
            }
            onBlur={(e) => {
              if (!e.target.value.trim()) {
                const heroBlock = template.data?.pages?.[0]?.content_blocks?.find((b) => b.type === 'hero');
                const fallbackDesc =
                  heroBlock?.content?.subheadline || heroBlock?.content?.headline || '';
                onChange({
                  ...template,
                  meta: { ...template.meta, description: fallbackDesc },
                });
              }
            }}
            className="bg-gray-800 text-white border border-gray-700 flex-1"
          />
          <button
            onClick={() => {
              const heroBlock = template.data?.pages?.[0]?.content_blocks?.find((b) => b.type === 'hero');
              const fallbackDesc =
                heroBlock?.content?.subheadline || heroBlock?.content?.headline || '';
              onChange({
                ...template,
                meta: { ...template.meta, description: fallbackDesc },
              });
            }}
            className="text-sm bg-gray-700 text-white px-2 py-1 rounded hover:bg-gray-600"
          >
            Use Hero Subheadline
          </button>
        </div>

      </div>
    </Collapsible>
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

          <ThemePreviewCard theme={template.theme || ''} onSelectFont={(font: string  ) => onChange({ ...template, theme: font })} />

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
