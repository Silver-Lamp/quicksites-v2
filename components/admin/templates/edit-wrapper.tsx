'use client';

import { useEffect, useState } from 'react';
import TemplateEditor from '@/components/admin/templates/template-editor';
import { supabase } from '@/lib/supabase/client';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import type { Template, Snapshot } from '@/types/template';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';
import AdminChrome from '../admin-chrome';

type EditWrapperProps =
  | { id: string; slug?: never; initialTemplate?: Template }
  | { slug: string; id?: never; initialTemplate?: Template };

// --- helpers ----------------------------------------------------
function coalescePages(obj: any): any[] {
  if (Array.isArray(obj?.data?.pages)) return obj.data.pages;
  if (Array.isArray(obj?.pages)) return obj.pages;
  return [];
}
function coalesceBlock(obj: any, key: 'headerBlock' | 'footerBlock') {
  return obj?.data?.[key] ?? obj?.[key] ?? null;
}
// ----------------------------------------------------------------

export default function EditWrapper(props: EditWrapperProps) {
  const isId = 'id' in props;
  const column = isId ? 'id' : 'slug';
  const value = isId ? props.id : props.slug;

  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const hydrate = async (rawIn?: Template | null) => {
      const raw = rawIn ?? null;

      if (!raw) {
        setData(null);
        setLoading(false);
        return;
      }

      // Grab DB pages/blocks BEFORE transforms
      const pagesFromDB = coalescePages(raw);
      const headerFromDB = coalesceBlock(raw, 'headerBlock');
      const footerFromDB = coalesceBlock(raw, 'footerBlock');

      // Normalize (structure/compat)
      let normalized = normalizeTemplate(raw);

      // Prep + clean (layout-only), then re-inject authoritative pieces
      const dbPayload = prepareTemplateForSave(normalized);
      const layoutOnly = cleanTemplateDataStructure(dbPayload);

      const cleanedLayout: Record<string, any> = {
        pages: pagesFromDB,
        ...(layoutOnly?.meta ? { meta: layoutOnly.meta } : {}),
        ...(headerFromDB ? { headerBlock: headerFromDB } : {}),
        ...(footerFromDB ? { footerBlock: footerFromDB } : {}),
      };

      // Choose pages (prefer normalized top-level if present)
      const normTopPages = Array.isArray((normalized as any).pages) ? (normalized as any).pages : [];
      const pages = normTopPages.length ? normTopPages : (Array.isArray(cleanedLayout.pages) ? cleanedLayout.pages : []);

      const finalSnap: Snapshot = {
        ...normalized,
        pages,                               // mirror to top level
        data: { ...cleanedLayout, pages },   // canonical location
      };

      if (!cancelled) {
        setData(finalSnap);
        setLoading(false);
      }
    };

    const load = async () => {
      setLoading(true);

      // If server already provided the row, use it (avoids re-fetch)
      if (props.initialTemplate) {
        await hydrate(props.initialTemplate);
        return;
      }

      // Client fetch (RLS enforced): id → eq('id', …), slug → eq('slug', …)
      const { data: raw, error } = await supabase
        .from('templates')
        .select('*')
        .eq(column, value)
        .maybeSingle<Template>();

      if (error || !raw) {
        if (error) console.error(`[EditWrapper] Supabase error for ${column}="${value}":`, error.message);
        if (!cancelled) {
          setData(null);
          setLoading(false);
        }
        return;
      }

      await hydrate(raw);
    };

    load();

    return () => {
      cancelled = true;
    };
    // re-run when the key changes
  }, [column, value, props.initialTemplate]);

  if (loading) return <div className="p-6 text-muted-foreground text-sm italic">Loading template...</div>;
  if (!data) return <div className="p-6 text-red-500">Template not found.</div>;

  // Derive a nice label for editor chrome
  const templateLabel =
    data.template_name ||
    (isId ? props.id : props.slug) ||
    'Template';

  return (
    <AdminChrome>
      <TemplateEditorProvider templateName={templateLabel} colorMode="dark">
        <TemplateEditor templateName={data.template_name} initialData={data} colorMode="dark" />
      </TemplateEditorProvider>
    </AdminChrome>
  );
}
