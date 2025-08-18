'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import TemplateEditor from '@/components/admin/templates/template-editor';
import type { TemplateSnapshot } from '@/types/template';
import { createEmptyTemplate } from '@/lib/createEmptyTemplate';

/** Fallback local slug generator */
function generateLocalSlug(base = 'new-template') {
  return `${base}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Try Supabase RPC for a unique template slug, fallback to local */
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
  const [uniqueSlug, setUniqueSlug] = useState<string | null>(null);

  useEffect(() => {
    async function initializeTemplate() {
      const slug = await getUniqueTemplateSlug();
      setUniqueSlug(slug);

      if (!from) {
        const fresh = createEmptyTemplate(slug);
        console.log('[🧪 Fresh new template]', fresh);
        setInitialData(fresh);
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

      const { data: auth } = await supabase.auth.getUser();
      if (auth?.user?.id) {
        await supabase.from('remix_events').insert([
          {
            original_snapshot_id: from,
            user_id: auth.user.id,
          },
        ]);
      }

      const remixed = createEmptyTemplate(slug);
      remixed.data = {
        services: Array.isArray(snapshot.data?.services) ? snapshot.data.services : [],
        pages: Array.isArray(snapshot.data?.pages) ? snapshot.data.pages : [],
      };

      remixed.color_scheme = snapshot.color_scheme ?? 'neutral';
      remixed.theme = snapshot.theme ?? 'default';
      remixed.brand = snapshot.brand ?? 'default';
      remixed.is_site = snapshot.is_site ?? false;
      remixed.published = false;

      console.log('[🧪 Remixed from snapshot]', remixed);
      setInitialData(remixed);
    }

    initializeTemplate();
  }, [from]);

  if (!uniqueSlug) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="animate-pulse text-white/60 bg-neutral-800 px-6 py-4 rounded shadow border border-neutral-700">
          Generating unique template slug...
        </div>
      </div>
    );
  }

  console.log('[🧪 Final initialData being passed]', initialData);
  console.log('[🧪 Final initialData.data]', initialData?.data);

  return (
    <TemplateEditor
      templateName={uniqueSlug}
      initialData={initialData || undefined}
    />
  );
}
