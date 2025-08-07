'use client';

import { useEffect, useState } from 'react';
import TemplateEditor from '@/components/admin/templates/template-editor';
import { supabase } from '@/lib/supabaseClient';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import type { Template, Snapshot } from '@/types/template';
import { TemplateEditorProvider } from '@/context/template-editor-context';
import { prepareTemplateForSave } from '@/admin/lib/prepareTemplateForSave';
import { cleanTemplateDataStructure } from '@/admin/lib/cleanTemplateData';

type Props = {
  slug: string;
};

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

      if (error) {
        console.error(`[EditWrapper] Supabase error for slug "${slug}":`, error.message);
        setData(null);
        setLoading(false);
        return;
      }

      if (!raw) {
        setData(null);
        setLoading(false);
        return;
      }

      // 🧪 Log full raw Supabase payload for diagnostics
      console.log('[📦 Raw Supabase template]', raw);

      const normalized = normalizeTemplate(raw);

      // 🧼 Step 1: prepare for DB-safe splitting
      const dbPayload = prepareTemplateForSave(normalized);

      // 🧼 Step 2: keep only layout-relevant fields for `.data`
      const layoutOnly = cleanTemplateDataStructure(dbPayload);

      // 🧪 Diagnostic: log and auto-strip any unexpected keys
      const allowed = ['pages', 'meta', 'headerBlock', 'footerBlock'];
      const cleanedLayout: Record<string, any> = {};
      const extraKeys: string[] = [];

      for (const [key, value] of Object.entries(layoutOnly)) {
        if (allowed.includes(key)) {
          cleanedLayout[key] = value;
        } else {
          extraKeys.push(key);
        }
      }

      if (extraKeys.length > 0) {
        console.warn('[🚨 Stripped invalid keys from layout .data]', extraKeys);
      } else {
        console.log('[✅ Layout-only data is clean]', Object.keys(cleanedLayout));
      }

      // 🧱 Step 3: Rehydrate for editor
      const final: Snapshot = {
        ...normalized,
        data: cleanedLayout,
      };

      setData(final);
      setLoading(false);
    };

    loadTemplate();
  }, [slug]);

  if (loading) {
    return <div className="p-6 text-muted-foreground text-sm italic">Loading template...</div>;
  }

  if (!data) {
    return <div className="p-6 text-red-500">Template not found.</div>;
  }

  return (
    <TemplateEditorProvider templateName={slug} colorMode="light">
      <TemplateEditor
        templateName={data.template_name}
        initialData={data}
        colorMode="light"
      />
    </TemplateEditorProvider>
  );
}
