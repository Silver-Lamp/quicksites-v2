// app/admin/templates/new/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { TemplateSnapshot } from '@/types/template';
import { createEmptyTemplate } from '@/lib/createEmptyTemplate';

/** Optional fallback generator */
function generateLocalSlug(base = 'new-template') {
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Use Supabase RPC to generate a unique name */
async function getUniqueTemplateSlug(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_unique_template_name');
  if (error || !data) {
    console.warn('[⚠️ RPC fallback] generate_unique_template_name failed:', error?.message);
    return generateLocalSlug();
  }
  return data;
}

export default function NewTemplatePage() {
  const searchParams = useSearchParams();
  const from = searchParams?.get('from') ?? '';

  const [initialData, setInitialData] = useState<TemplateSnapshot | null>(null);
  const [uniqueSlug, setUniqueSlug] = useState<string>('');

  useEffect(() => {
    async function initializeTemplate() {
      const slug = await getUniqueTemplateSlug();
      setUniqueSlug(slug);

      if (!from) {
        const newTemplate = createEmptyTemplate(slug);
        setInitialData(newTemplate);
        return;
      }

      const { data: snapshot, error } = await supabase
        .from('snapshots')
        .select('data, theme, brand, color_scheme, is_site')
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

      const remixed = createEmptyTemplate(slug);
      remixed.data = snapshot.data;
      remixed.color_scheme = snapshot.color_scheme ?? 'neutral';
      remixed.theme = snapshot.theme ?? 'default';
      remixed.brand = snapshot.brand ?? 'default';
      remixed.is_site = snapshot.is_site ?? false;
      remixed.published = false;
      setInitialData(remixed);
    }

    initializeTemplate();
  }, [from]);

  return (
    <TemplateEditor
      templateName={uniqueSlug || 'new-template'}
      initialData={initialData || undefined}
    />
  );
}
