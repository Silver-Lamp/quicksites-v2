'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import TemplateEditor from '@/components/admin/templates/template-editor';
import { TemplateSnapshot } from '@/types/template';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Snapshot = {
  data: any;
  theme?: string;
  brand?: string;
  color_scheme?: string;
  template_name?: string;
};

export default function NewTemplatePage() {
  const searchParams = useSearchParams();
  const from = searchParams?.get('from') ?? '';
  const [initialData, setInitialData] = useState<Snapshot | null>(null);

  useEffect(() => {
    async function loadSnapshot() {
      if (!from) return;

      const { data: snapshot, error } = await supabase
        .from('snapshots')
        .select('data, theme, brand, color_scheme')
        .eq('id', from)
        .maybeSingle();

      if (error || !snapshot) {
        console.warn('⚠️ Could not load snapshot:', error?.message);
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.id) {
        await supabase.from('remix_events').insert([
          {
            original_snapshot_id: from,
            user_id: user.id,
          },
        ]);
      }

      setInitialData({
        template_name: 'Untitled (Remix)',
        color_scheme: snapshot.color_scheme,
        theme: snapshot.theme,
        brand: snapshot.brand,
        data: snapshot.data,
      });
    }

    loadSnapshot();
  }, [from]);

  return (
    <div className="p-4">
      <div className="text-red-500">new template page</div>
      <h1 className="text-xl font-bold mb-4">New Template</h1>
      <TemplateEditor
        templateName="new-template"
        initialData={initialData as TemplateSnapshot | undefined}
      />
    </div>
  );
}