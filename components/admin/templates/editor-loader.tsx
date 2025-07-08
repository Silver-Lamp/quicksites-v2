'use client';

import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/supabase';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Snapshot } from '@/types/template';

export default function EditTemplatePage() {
  const { slug } = useParams() as { slug: string };
  const [template, setTemplate] = useState<Snapshot | null>(null);
  const supabase = useMemo(() => createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);

  useEffect(() => {
    if (!slug) return;

    supabase
      .from('templates')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error) console.error(error);
        else setTemplate(data);
      });
  }, [slug]);

  if (!template) {
    return <div className="p-6 text-muted-foreground text-sm italic">Loading template…</div>;
  }

  return (
    <TemplateEditor
      templateName={template.template_name}
      initialData={template}
    />
  );
}
