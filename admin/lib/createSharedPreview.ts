import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
// The cookie-aware browser client: the snapshot row is inserted AS THE OWNER, which is what
// `snapshots_owner_insert` (migration 20260902) requires. A bare anon-key client carried no
// session and would be refused.
import { supabase } from '@/lib/supabase/client';

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

    // Untyped on purpose: this legacy row shape (shared_at, is_site…) predates the generated types.
    const { error: insertError } = await (supabase as any).from('snapshots').insert([
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
