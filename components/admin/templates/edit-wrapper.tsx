// components/admin/templates/edit-wrapper.tsx
'use client';

import { useEffect, useState } from 'react';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Snapshot } from '@/types/template';
import { supabase } from '@/lib/supabaseClient';

export default function EditWrapper({ slug }: { slug: string }) {
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!error && data) setData(data);
      else setData(null);

      setLoading(false);
    };

    load();
  }, [slug]);

  if (loading) return <div className="p-6 text-muted-foreground text-sm italic">Loading template...</div>;
  if (!data) return <div>Template not found.</div>;

  return <TemplateEditor templateName={data.template_name} initialData={data} />;
}
