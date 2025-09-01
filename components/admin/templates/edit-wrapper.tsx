'use client';

import { useEffect, useMemo, useState } from 'react';
import TemplateEditor from '@/components/admin/templates/template-editor';
import { supabase } from '@/lib/supabase/client';
import type { Template } from '@/types/template';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import AdminChrome from '../admin-chrome';

type EditWrapperProps =
  | { id: string; slug?: never; initialTemplate?: Template }
  | { slug: string; id?: never; initialTemplate?: Template };

/* ----------------- helpers ----------------- */
function safeParse(x: unknown) {
  if (typeof x !== 'string') return (x as any) ?? {};
  try { return JSON.parse(x); } catch { return {}; }
}

function coalescePages(obj: any): any[] {
  if (Array.isArray(obj?.data?.pages)) return obj.data.pages;
  if (Array.isArray(obj?.pages)) return obj.pages;
  return [];
}

function withSyncedPages<T extends { data?: any; pages?: any[] }>(tpl: T): T {
  const pages = coalescePages(tpl);
  return { ...tpl, pages, data: { ...(tpl.data ?? {}), pages } } as T;
}

function normalizeDraftRow(row: any): Template {
  const dataObj = safeParse(row?.data);
  // promote chrome + color into data if missing
  if (row?.header_block && !dataObj.headerBlock) dataObj.headerBlock = row.header_block;
  if (row?.footer_block && !dataObj.footerBlock) dataObj.footerBlock = row.footer_block;
  if (row?.color_mode && !dataObj.color_mode) dataObj.color_mode = row.color_mode;

  const base: Template = {
    id: row.id,
    template_name: row.template_name ?? row.slug ?? 'Untitled',
    slug: row.slug ?? undefined,
    data: dataObj,
    headerBlock: row.header_block ?? null,
    footerBlock: row.footer_block ?? null,
    color_mode: (row.color_mode as 'light' | 'dark' | undefined) ?? 'light',
    domain: row.domain ?? undefined,
    default_subdomain: row.default_subdomain ?? undefined,
    is_site: !!row.is_site,
  } as any;

  return withSyncedPages(base);
}
/* ------------------------------------------- */

export default function EditWrapper(props: EditWrapperProps) {
  const isId = 'id' in props;
  const column = isId ? 'id' : 'slug';
  const value = isId ? props.id : props.slug;

  const [template, setTemplate] = useState<Template | null>(props.initialTemplate ?? null);
  const [loading, setLoading] = useState(!props.initialTemplate);
  const [error, setError] = useState<string | null>(null);

  // Fetch draft template (never a version row)
  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!value) {
        setTemplate(null);
        setLoading(false);
        return;
      }

      // If initialTemplate was provided, trust it (normalized below)
      if (props.initialTemplate) {
        if (!cancelled) {
          setTemplate(withSyncedPages(props.initialTemplate));
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      const select =
        'id, template_name, slug, base_slug, data, header_block, footer_block, color_mode, domain, default_subdomain, is_version, is_site';

      const { data, error } = await supabase
        .from('templates')
        .select(select)
        .eq(column, value)
        .eq('is_version', false)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        if (error) console.error('[EditWrapper] load error:', error.message);
        setError('Template not found or access denied.');
        setTemplate(null);
        setLoading(false);
        return;
      }

      const normalized = normalizeDraftRow(data);
      setTemplate(normalized);
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
    // re-run when key changes or initialTemplate changes
  }, [column, value, props.initialTemplate]);

  if (loading) {
    return <div className="p-6 text-muted-foreground text-sm italic">Loading template…</div>;
  }
  if (error) {
    return <div className="p-6 text-red-500 text-sm">{error}</div>;
  }
  if (!template) {
    return <div className="p-6 text-red-500 text-sm">Template not found.</div>;
  }

  // Label for editor chrome
  const templateLabel = template.template_name || (isId ? props.id : props.slug) || 'Template';
  const colorMode = (template.color_mode as 'light' | 'dark') ?? 'light';

  return (
    <AdminChrome>
      <TemplateEditorProvider templateName={templateLabel} colorMode={colorMode}>
        <TemplateEditor
          templateName={template.template_name}
          initialData={template}
          initialMode={template.is_site ? 'site' : 'template'}
          colorMode={colorMode}
        />
      </TemplateEditorProvider>
    </AdminChrome>
  );
}
