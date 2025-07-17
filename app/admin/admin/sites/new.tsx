'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import debounce from 'lodash.debounce';
import type { Database } from '@/types/supabase';
import TemplatePreviewWithToggle from '@/components/admin/templates/template-preview-with-toggle';
import ThemeScope from '@/components/ui/theme-scope';

const supabase = createClientComponentClient<Database>();

type BrandingProfile = {
  id: string;
  name: string;
  logo_url?: string;
};

type Template = {
  id: string;
  name: string;
  created_at: string;
  thumbnail_url?: string;
  data: any;
  theme?: string;
  brand?: string;
  color_scheme?: string;
  is_site?: boolean;
  published?: boolean;
};

export default function NewSitePage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<BrandingProfile[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<BrandingProfile | null>(null);
  const [templateData, setTemplateData] = useState<any | null>(null);
  const [isDark, setIsDark] = useState(false);

  const [form, setForm] = useState({
    slug: '',
    site_name: '',
    branding_profile_id: '',
    template_id: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [checkingSlug, setCheckingSlug] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState(false);

  useEffect(() => {
    supabase
      .from('branding_profiles')
      .select('id, name, logo_url')
      .then(({ data }) => setProfiles(data || []));

    supabase
      .from('templates')
      .select('id, name, created_at, thumbnail_url, data, theme, brand, color_scheme, is_site, published')
      .eq('published', true)
      .eq('is_site', false)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setTemplates(data);
          const initialTemplate = data[0];
          setForm((f) => ({ ...f, template_id: f.template_id || initialTemplate.id }));
          setSelectedTemplate(initialTemplate);
          setTemplateData(initialTemplate.data || null);
        }
      });
  }, []);

  useEffect(() => {
    const selected = templates.find((t) => t.id === form.template_id);
    setSelectedTemplate(selected || null);
    setTemplateData(selected?.data || null);
  }, [form.template_id]);

  useEffect(() => {
    const selected = profiles.find((p) => p.id === form.branding_profile_id);
    setSelectedProfile(selected || null);
  }, [form.branding_profile_id]);

  const checkSlugUniqueness = debounce(async (slug: string) => {
    if (!slug) return;
    setCheckingSlug(true);
    const { data } = await supabase.from('sites').select('id').eq('slug', slug);
    setSlugError(data?.length ? 'Slug is already in use' : null);
    setSlugAvailable(!data?.length);
    setCheckingSlug(false);
  }, 400);

  useEffect(() => {
    const generatedSlug = form.site_name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    setForm((f) => ({ ...f, slug: generatedSlug }));
    checkSlugUniqueness(generatedSlug);
  }, [form.site_name]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (slugError) {
      setLoading(false);
      return;
    }

    let data = {};

    if (form.template_id) {
      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('data')
        .eq('id', form.template_id)
        .single();

      if (templateError || !template?.data) {
        setLoading(false);
        setError('Failed to load template data');
        return;
      }

      data = template.data;
    }

    const { data: siteData, error } = await supabase
      .from('sites')
      .insert([
        {
          slug: form.slug,
          site_name: form.site_name,
          branding_profile_id: form.branding_profile_id || null,
          template_id: form.template_id || null,
          data,
          is_published: false,
        },
      ])
      .select()
      .single();

    setLoading(false);

    if (error) {
      setError(error.message);
    } else if (siteData?.slug) {
      router.push(`/site/${siteData.slug}/edit`);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">Create New Site</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium">Site Name</label>
          <input
            className="border px-2 py-1 w-full rounded"
            placeholder="e.g. Towing Pro"
            value={form.site_name}
            onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Slug</label>
          <input
            className="border px-2 py-1 w-full rounded"
            placeholder="e.g. towing-pro"
            value={form.slug}
            onChange={(e) => {
              const raw = e.target.value;
              const sanitized = raw
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9-]+/g, '-')
                .replace(/(^-|-$)/g, '');
              setForm((f) => ({ ...f, slug: sanitized }));
              checkSlugUniqueness(sanitized);
            }}
            required
          />
          {form.slug && (
            <p className="text-sm text-muted-foreground mt-1">
              URL Preview: <code>{form.slug}.quicksites.ai</code>{' '}
              {slugAvailable && <span className="text-green-500 ml-2">✅ Available</span>}
            </p>
          )}
          {checkingSlug && <p className="text-sm text-yellow-500">Checking availability...</p>}
          {slugError && <p className="text-sm text-red-500">{slugError}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium">Template</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={form.template_id}
            onChange={(e) => setForm((f) => ({ ...f, template_id: e.target.value }))}
          >
            <option value="">— Select a template —</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Branding Profile</label>
          <select
            className="w-full border rounded px-2 py-1"
            value={form.branding_profile_id}
            onChange={(e) => setForm((f) => ({ ...f, branding_profile_id: e.target.value }))}
          >
            <option value="">— Select profile —</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          {selectedProfile?.logo_url && (
            <div className="mt-2">
              <img
                src={selectedProfile.logo_url}
                alt="Brand logo"
                className="h-12 w-12 rounded object-contain"
              />
            </div>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading || !!slugError || !slugAvailable}
          className={`px-4 py-2 rounded mt-4 text-white ${
            loading || slugError || !slugAvailable ? 'bg-gray-500' : 'bg-black'
          }`}
        >
          {loading ? 'Creating...' : 'Create Site'}
        </button>
      </form>

      {templateData && (
        <div className="pt-6">
          <h2 className="text-lg font-semibold mb-2 flex justify-between items-center">
            <span>Live Template Preview</span>
            <button
              onClick={() => setIsDark((prev) => !prev)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              Toggle {isDark ? 'Light' : 'Dark'} Mode
            </button>
          </h2>
          <ThemeScope mode={isDark ? 'dark' : 'light'}>
            <div className="border rounded shadow overflow-hidden">
              <TemplatePreviewWithToggle
                data={templateData}
                theme={selectedTemplate?.theme || 'light'}
                brand={selectedTemplate?.brand || ''}
                colorScheme={selectedTemplate?.color_scheme || 'gray'}
                isDark={isDark}
                toggleDark={() => setIsDark((prev) => !prev)}
              />
            </div>
          </ThemeScope>
        </div>
      )}
    </div>
  );
}
