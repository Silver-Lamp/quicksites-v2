// app/admin/templates/template-editor-loader.tsx
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { supabase } from '@/lib/supabaseClient';

export function useEditorLoader(slug: string) {
  const [record, setRecord] = useState<any | null>(null);
  const [mode, setMode] = useState<'template' | 'site' | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: site, error: siteError } = await supabase
        .from('sites')
        .select('*')
        .eq('slug', slug)
        .single();

      if (site) {
        setMode('site');
        setRecord(site);
        return;
      }

      const { data: template, error: templateError } = await supabase
        .from('templates')
        .select('*')
        .eq('slug', slug)
        .single();

      if (template) {
        const draftKey = `draft-${template.id}`;
        const savedDraft = localStorage.getItem(draftKey);

        if (savedDraft) {
          try {
            const parsed = JSON.parse(savedDraft);
            if (parsed && parsed.pages && parsed.pages.length > 0) {
              toast((t) => (
                <span>
                  📝 A draft was found.
                  <button
                    className="ml-2 underline text-blue-400"
                    onClick={() => {
                      toast.dismiss(t.id);
                      setRecord({ ...template, data: parsed });
                    }}
                  >
                    Restore it?
                  </button>
                </span>
              ));
              setRecord({ ...template }); // Don't restore by default
              setMode('template');
              return;
            }
          } catch (err) {
            console.warn('Failed to parse draft JSON');
          }
        }

        setRecord(template);
        setMode('template');
      } else {
        toast.error('Failed to load template or site from DB');
      }
    };

    load();
  }, [slug]);

  return { record, mode };
}
