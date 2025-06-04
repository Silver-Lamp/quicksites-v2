import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { createClient } from '@supabase/supabase-js';
import TemplateEditor from '@/components/templates/TemplateEditor';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function NewTemplatePage() {
  const router = useRouter();
  const { from } = router.query;
  const [initialData, setInitialData] = useState<any | null>(null);

  useEffect(() => {
    const loadSnapshot = async () => {
      if (!from || typeof from !== 'string') return;

      const { data: snapshot, error } = await supabase
        .from('snapshots')
        .select('data, theme, brand, color_scheme')
        .eq('id', from)
        .single();

      if (error) {
        console.warn('Could not load snapshot:', error.message);
        return;
      }

      // Optional: record remix
      const user = await supabase.auth.getUser();
      const userId = user?.data?.user?.id;

      if (userId) {
        await supabase.from('remix_events').insert([
          {
            original_snapshot_id: from,
            user_id: userId
          }
        ]);
      }

      setInitialData({
        template_name: 'Untitled (Remix)',
        layout: 'default',
        color_scheme: snapshot.color_scheme,
        theme: snapshot.theme,
        brand: snapshot.brand,
        data: snapshot.data
      });
    };

    loadSnapshot();
  }, [from]);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">New Template</h1>
      <TemplateEditor templateName="new-template" initialTemplate={initialData} />
    </div>
  );
}
