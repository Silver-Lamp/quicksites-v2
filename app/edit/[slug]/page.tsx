// app/edit/[slug]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { Snapshot } from '@/types/template';
import type { Database } from '@/types/supabase';
import { fetchTemplateBySlug } from './template-loader';
import { Metadata } from 'next';

// export async function generateMetadata({
//   params,
// }: {
//   params: { slug: string };
// }): Promise<Metadata> {
//   const data = await fetchTemplateBySlug(params.slug);

//   return {
//     title: data ? `Edit: ${data.template_name}` : 'Template Not Found',
//     description: data
//       ? `Editing template for ${data.template_name}`
//       : 'No template found for that slug',
//   };
// }

export default function EditPage() {
  const { slug } = useParams() as { slug: string };
  const supabase = createClientComponentClient<Database>();

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
