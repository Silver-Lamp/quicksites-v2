// app/edit/[slug]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Snapshot } from '@/types/template';
import { supabase } from '@/lib/supabaseClient';

export default function EditPage() {
  const { slug } = useParams() as { slug: string };
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const load = async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error || !data) {
        setData(null);
      } else {
        setData(data);
      }

      setLoading(false);
    };

    load();
  }, [slug]);

  if (loading) {
    return <div className="p-6 text-muted-foreground text-sm italic">Loading template...</div>;
  }

  if (!data) {
    notFound();
  }

  return <TemplateEditor templateName={data.template_name} initialData={data} />;
}
