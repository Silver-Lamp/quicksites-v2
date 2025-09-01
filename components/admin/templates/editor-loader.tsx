// app/admin/templates/template-editor-loader.tsx
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Template } from '@/types/template';

type DraftRow = {
  id: string;
  template_name: string | null;
  slug: string | null;
  base_slug?: string | null;
  data: any; // may be object or stringified
  header_block?: any | null;
  footer_block?: any | null;
  color_mode?: 'light' | 'dark' | null;
  domain?: string | null;
  default_subdomain?: string | null;
  is_version?: boolean | null;
  is_site?: boolean | null;
};

function isUuidLike(s: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
}

function safeParse(x: any) {
  if (typeof x !== 'string') return x ?? {};
  try { return JSON.parse(x); } catch { return {}; }
}

function withSyncedPages<T extends { data?: any; pages?: any[] }>(tpl: T): T {
  const pages = Array.isArray(tpl?.data?.pages) ? tpl.data.pages
              : Array.isArray(tpl?.pages) ? tpl.pages
              : [];
  return { ...tpl, pages, data: { ...(tpl.data ?? {}), pages } } as T;
}

export default function EditTemplatePage() {
  const { slug } = useParams() as { slug: string };
  const [template, setTemplate] = useState<Template | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = useMemo(
    () =>
      createBrowserClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError(null);
      setTemplate(null);
      if (!slug) return;

      const baseSelect =
        'id, template_name, slug, base_slug, data, header_block, footer_block, color_mode, domain, default_subdomain, is_version, is_site';

      // Try by id if UUID-like
      const tryById = async (): Promise<DraftRow | null> => {
        if (!isUuidLike(slug)) return null;
        const { data, error } = await supabase
          .from('templates')
          .select(baseSelect)
          .eq('id', slug)
          .eq('is_version', false)
          .maybeSingle();
        if (error) console.warn('[loader] by id error:', error.message);
        return (data as any) ?? null;
      };

      // Try by slug, then base_slug
      const tryBySlugOrBase = async (): Promise<DraftRow | null> => {
        const q1 = await supabase
          .from('templates')
          .select(baseSelect)
          .eq('slug', slug)
          .eq('is_version', false)
          .maybeSingle();
        if (q1.data) return q1.data as any;

        const q2 = await supabase
          .from('templates')
          .select(baseSelect)
          .eq('base_slug', slug)
          .eq('is_version', false)
          .maybeSingle();
        if (q2.data) return q2.data as any;

        if (q1.error) console.warn('[loader] by slug error:', q1.error.message);
        if (q2.error) console.warn('[loader] by base_slug error:', q2.error.message);
        return null;
      };

      let row: DraftRow | null = (await tryById()) ?? (await tryBySlugOrBase());

      if (!row) {
        if (!cancelled) setError('Template not found or you do not have access.');
        return;
      }

      // Normalize draft into Template shape the editor expects
      const dataObj = safeParse(row.data);
      if (row.header_block && !dataObj.headerBlock) dataObj.headerBlock = row.header_block;
      if (row.footer_block && !dataObj.footerBlock) dataObj.footerBlock = row.footer_block;
      if (row.color_mode && !dataObj.color_mode) dataObj.color_mode = row.color_mode;

      const draft: Template = withSyncedPages({
        id: row.id,
        template_name: row.template_name ?? row.slug ?? 'Untitled',
        slug: row.slug ?? undefined,
        data: dataObj,
        headerBlock: row.header_block ?? null,
        footerBlock: row.footer_block ?? null,
        color_mode: (row.color_mode as any) ?? 'light',
        domain: row.domain ?? undefined,
        default_subdomain: row.default_subdomain ?? undefined,
        is_site: !!row.is_site,
        // include any other fields your Template type expects as needed
      } as any);

      if (!cancelled) setTemplate(draft);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, supabase]);

  if (error) {
    return (
      <div className="p-6 text-sm text-red-400">
        {error}
      </div>
    );
  }

  if (!template) {
    return <div className="p-6 text-muted-foreground text-sm italic">Loading template…</div>;
  }

  return (
    <TemplateEditor
      templateName={template.template_name}
      initialData={template}
      initialMode={template.is_site ? 'site' : 'template'}
      colorMode={(template.color_mode as 'light' | 'dark') ?? 'light'}
    />
  );
}
