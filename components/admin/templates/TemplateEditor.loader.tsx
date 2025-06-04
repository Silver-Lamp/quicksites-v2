import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useTemplateLoader(templateName: string) {
  const [template, setTemplate] = useState<any | null>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .eq('template_name', templateName)
        .single();

      if (error || !data) {
        toast.error('Failed to load template from DB');
        return;
      }

      const draftKey = `draft-${data.id}`;
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
                    setTemplate({ ...data, data: parsed });
                  }}
                >
                  Restore it?
                </button>
              </span>
            ));
            setTemplate({ ...data }); // Don't restore by default
            return;
          }
        } catch (err) {
          console.warn('Failed to parse draft JSON');
        }
      }

      setTemplate(data);
    };

    loadTemplate();
  }, [templateName]);

  return template;
}
