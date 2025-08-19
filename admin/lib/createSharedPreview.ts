import { createClient } from '@supabase/supabase-js';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function createSharedPreview({
  templateId,
  templateName,
  commitMessage,
  templateData,
  theme,
  brand,
  colorScheme,
  isSite,
}: {
  templateId: string;
  templateName: string;
  commitMessage?: string;
  templateData: any;
  theme?: string;
  brand?: string;
  colorScheme?: string;
  isSite?: boolean;
}): Promise<string | null> {
  const node = document.getElementById('preview-capture');
  if (!node) {
    toast.error('No preview to share');
    return null;
  }

  try {
    const id = crypto.randomUUID();
    const dataUrl = await toPng(node, { cacheBust: true });
    const blob = await (await fetch(dataUrl)).blob();
    const filePath = `previews/${templateId}/shared.png`;

    const { error: uploadError } = await supabase.storage.from('previews').upload(filePath, blob, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/png',
    });

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
        toast.error('Supabase bucket "previews" not found.');
      } else {
        toast.error(`Upload failed: ${uploadError.message}`);
      }
      return null;
    }

    const { data: urlData } = supabase.storage.from('previews').getPublicUrl(filePath);
    const public_url = urlData?.publicUrl;

    const { error: insertError } = await supabase.from('snapshots').insert([
      {
        id,
        template_id: templateId,
        template_name: templateName,
        commit_message: commitMessage || '',
        data: templateData,
        theme,
        brand,
        color_scheme: colorScheme,
        is_site: isSite,
        thumbnail_url: public_url,
        shared_at: new Date().toISOString(),
      },
    ]);

    if (insertError) {
      toast.error(`Snapshot DB insert failed: ${insertError.message}`);
      return null;
    }

    return id;
  } catch (err) {
    console.error('Snapshot creation failed:', err);
    toast.error('Unexpected error uploading snapshot');
    return null;
  }
}
