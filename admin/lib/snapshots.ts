import { createClient } from '@supabase/supabase-js';
import { toast } from 'react-hot-toast';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function createSnapshot({
  templateId,
  templateName,
  commitMessage,
  data,
  theme,
  brand,
  colorScheme,
  editorEmail,
  thumbnailUrl,
  isSite,
  published,
}: {
  templateId: string;
  templateName: string;
  commitMessage: string;
  data: any;
  theme?: string;
  brand?: string;
  colorScheme?: string;
  editorEmail?: string;
  thumbnailUrl?: string;
  isSite?: boolean;
  published?: boolean;
}) {
  const { data: result, error } = await supabase
    .from('snapshots')
    .insert([
      {
        template_id: templateId,
        template_name: templateName,
        commit_message: commitMessage,
        data,
        theme,
        brand,
        color_scheme: colorScheme,
        editor_email: editorEmail,
        thumbnail_url: thumbnailUrl,
        shared_at: new Date().toISOString(),
        is_site: isSite,
        published: published,
      },
    ])
    .select('*')
    .single();

  if (error) {
    toast.error('Snapshot creation failed');
    console.error(error);
    return null;
  }

  toast.success('Snapshot created');
  return result;
}
