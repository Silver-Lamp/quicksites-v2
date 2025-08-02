'use client';

import { useEffect, useState } from 'react';
import TemplateEditor from '@/components/admin/templates/template-editor';
import { supabase } from '@/lib/supabaseClient';
import { normalizeTemplate } from '@/admin/utils/normalizeTemplate';
import type { Template, Snapshot } from '@/types/template';
import { TemplateEditorProvider } from '@/context/template-editor-context';

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

      const normalized = normalizeTemplate(raw);

      // Defensive: strip accidental top-level `pages` if not wrapped in `data`
      if ('pages' in normalized) {
        delete (normalized as any).pages;
      }

      setData(normalized);
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
