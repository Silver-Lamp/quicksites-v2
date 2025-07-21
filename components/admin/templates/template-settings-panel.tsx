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
import OGPreviewModal from '@/components/admin/og-preview-modal';

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

const MAX_TITLE_LENGTH = 60;
const MAX_DESC_LENGTH = 160;

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
  const [activeTab, setActiveTab] = useState<'general' | 'theme' | 'seo'>('general');
  const [showOGPreview, setShowOGPreview] = useState(false);

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

  const handleMetaChange = (key: 'title' | 'description', value: string) => {
    const meta = { ...template.meta, [key]: value };
    onChange({ ...template, meta });
  };

  return (
    <div className="space-y-6">
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
        <button
          onClick={() => setActiveTab('seo')}
          className={clsx('px-3 py-1 rounded', activeTab === 'seo' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-300')}
        >
          SEO
        </button>
      </div>
      {activeTab === 'seo' && (
        <div className="space-y-4">
          <div>
            <Label>SEO Title</Label>
            <Input
              value={template.meta?.title || ''}
              onChange={(e) => handleMetaChange('title', e.target.value)}
              placeholder="e.g. Best Tow Trucks in Phoenix"
            />
            <p className={`text-xs mt-1 ${template.meta?.title?.length && template.meta.title.length > MAX_TITLE_LENGTH ? 'text-red-400' : 'text-muted-foreground'}`}>
              {template.meta?.title?.length || 0} / {MAX_TITLE_LENGTH} characters
            </p>
          </div>

          <div>
            <Label>SEO Description</Label>
            <Input
              value={template.meta?.description || ''}
              onChange={(e) => handleMetaChange('description', e.target.value)}
              placeholder="e.g. QuickSites helps you launch a towing site fast."
            />
            <p className={`text-xs mt-1 ${template.meta?.description?.length && template.meta.description.length > MAX_DESC_LENGTH ? 'text-red-400' : 'text-muted-foreground'}`}>
              {template.meta?.description?.length || 0} / {MAX_DESC_LENGTH} characters
            </p>
          </div>

          <SeoPreviewThumbnail
            pageUrl={template.slug}
            ogImageUrl={template.meta?.ogImage || ''}
          />

          <SeoPreviewTestLinks url={template.slug} />

          <SeoShareCardPanel url={template.slug} />

          <OGBulkRebuild
            slug={template.slug}
            endpoint="/api/og/rebuild-all"
            onResult={(results: Record<string, string>) => {
              const failures = Object.entries(results).filter(([_, result]) => result.startsWith('❌'));
              if (failures.length > 0) {
                toast.error(`OG rebuild failed on ${failures.length} page(s): ${failures.join(', ')}`);
              } else {
                toast.success('✅ All OG images rebuilt successfully');
              }
            }}
          />

          <button
            onClick={() => setShowOGPreview(true)}
            className="text-sm underline text-indigo-400 hover:text-indigo-300"
          >
            View Current OG Image
          </button>

          <OGPreviewModal
            open={showOGPreview}
            onOpenChange={setShowOGPreview}
            ogImageUrl={template.meta?.ogImage || ''}
          />
        </div>
      )}
      {activeTab === 'general' && (
        <div className="flex gap-4 pt-4">
            <button
              onClick={() => {
                handleMetaChange('title', '');
                handleMetaChange('description', '');
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white text-sm px-4 py-2 rounded"
            >
              Reset Meta
            </button>
            <button
              onClick={() => toast.success('🌐 Multi-language meta coming soon')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm px-4 py-2 rounded"
            >
              i18n Setup
            </button>
          </div>
      )}
    </div>
  );
}
