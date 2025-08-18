'use client';

import { useEffect, useState } from 'react';
import TemplateEditor from '@/components/admin/templates/template-editor';
import { supabase } from '@/lib/supabase/client';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import type { Template, Snapshot } from '@/types/template';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';

type Props = { slug: string };

// --- helpers ----------------------------------------------------
function coalescePages(obj: any): any[] {
  if (Array.isArray(obj?.data?.pages)) return obj.data.pages;
  if (Array.isArray(obj?.pages)) return obj.pages;
  return [];
}
function coalesceBlock(obj: any, key: 'headerBlock' | 'footerBlock') {
  return obj?.data?.[key] ?? obj?.[key] ?? null;
}
function withSyncedPages<T extends { data?: any; pages?: any[] }>(tpl: T, pages: any[]): T {
  return { ...tpl, pages, data: { ...(tpl.data ?? {}), pages } } as T;
}
// ----------------------------------------------------------------

export default function EditWrapper({ slug }: Props) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTemplate = async () => {
      const { data: raw, error } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', slug)
        .maybeSingle<Template>();

      if (error || !raw) {
        if (error) console.error(`[EditWrapper] Supabase error for slug "${slug}":`, error.message);
        setData(null);
        setLoading(false);
        return;
      }

      // 1) Pull pages/blocks straight from DB BEFORE any transforms
      const pagesFromDB = coalescePages(raw);
      const headerFromDB = coalesceBlock(raw, 'headerBlock');
      const footerFromDB = coalesceBlock(raw, 'footerBlock');

      console.log('[📦 Raw Supabase template]', raw);

      // 2) Normalize (may shuffle things; don't trust it for pages)
      let normalized = normalizeTemplate(raw);

      // 3) Prep + clean layout (this may drop keys; we’ll re-inject)
      const dbPayload = prepareTemplateForSave(normalized);
      const layoutOnly = cleanTemplateDataStructure(dbPayload);

      // 4) Build the layout data explicitly
      const cleanedLayout: Record<string, any> = {
        // force pages back in
        pages: pagesFromDB,
        // keep any meta or allowed bits that survived cleaning
        ...(layoutOnly?.meta ? { meta: layoutOnly.meta } : {}),
        // force blocks back in
        ...(headerFromDB ? { headerBlock: headerFromDB } : {}),
        ...(footerFromDB ? { footerBlock: footerFromDB } : {}),
      };

      // 5) Final snapshot mirrored both ways
      // const final: Snapshot = withSyncedPages(
      //   {
      //     ...normalized,
      //     data: cleanedLayout,
      //     // keep root blocks too for any legacy readers
      //     ...(headerFromDB ? { headerBlock: headerFromDB } : {}),
      //     ...(footerFromDB ? { footerBlock: footerFromDB } : {}),
      //   } as Snapshot,
      //   pagesFromDB
      // );

      // console.log('[🧩 EditWrapper -> final snapshot]', {
      //   rootPages: final.pages?.length,
      //   dataPages: final.data?.pages?.length,
      //   firstPage: final.data?.pages?.[0]?.slug,
      // });


      const layoutPages = Array.isArray(cleanedLayout?.pages) ? cleanedLayout.pages : [];
      const normalizedTopPages =
        Array.isArray((normalized as any).pages) ? (normalized as any).pages : layoutPages;
      
      const pages = normalizedTopPages.length ? normalizedTopPages : layoutPages;
      
      const final: Snapshot = {
        ...normalized,
        pages,                                        // <-- mirror to top-level
        data: { ...cleanedLayout, pages },            // <-- and canonical location
      };
      
      console.log('[🧩 EditWrapper -> final snapshot]', {
        rootPages: final.pages?.length ?? 0,
        dataPages: final.data?.pages?.length ?? 0,
        firstPage: final.data?.pages?.[0]?.slug,
      });
      
      setData(final); 
      setLoading(false);
    };

    loadTemplate();
  }, [slug]);

  if (loading) return <div className="p-6 text-muted-foreground text-sm italic">Loading template...</div>;
  if (!data) return <div className="p-6 text-red-500">Template not found.</div>;

  return (
    <TemplateEditorProvider templateName={slug} colorMode="light">
      <TemplateEditor templateName={data.template_name} initialData={data} colorMode="light" />
    </TemplateEditorProvider>
  );
}
