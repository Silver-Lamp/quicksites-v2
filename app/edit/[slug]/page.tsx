'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Snapshot } from '@/types/template';
import type { Database } from '@/types/supabase';

export default function EditPage() {
  const { slug } = useParams() as { slug: string };
  const supabase = useMemo(() => createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ), []);
  const [data, setData] = useState<Snapshot | null>(null);

  useEffect(() => {
    if (!slug) return;
    supabase
      .from('templates')
      .select('*')
      .eq('slug', slug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          console.error('Failed to load template:', error);
          setData(null);
        } else {
          setData(data);
        }
      })      
  }, [slug]);

  if (!data) {
    return <div className="p-6 text-muted-foreground text-sm italic">Loading template…</div>;
  }

  if (data === null) {
    return <div className="p-6 text-red-500">Template not found or duplicate slug</div>;
  }
  
  return (
    <TemplateEditor
      templateName={data.template_name}
      initialData={data}
    />
  );
}
