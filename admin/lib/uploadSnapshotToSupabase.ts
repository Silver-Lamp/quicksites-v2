import { supabase } from '@/admin/lib/supabaseClient';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';

export async function uploadSnapshotToSupabase(templateId: string): Promise<string | null> {
  const node = document.getElementById('preview-capture');
  if (!node) {
    toast.error('No preview found to upload');
    return null;
  }

  try {
    const dataUrl = await toPng(node, { cacheBust: true });
    const blob = await (await fetch(dataUrl)).blob();
    const fileName = `snapshots/${templateId}/preview.png`;

    const { error: uploadError } = await supabase.storage
      .from('snapshots')
      .upload(fileName, blob, {
        cacheControl: '3600',
        upsert: true,
        contentType: 'image/png'
      });

    if (uploadError) {
      if (uploadError.message.includes('Bucket not found')) {
        toast.error('Supabase bucket "snapshots" not found. Please create it.');
      } else {
        toast.error(`Upload failed: ${uploadError.message}`);
      }
      return null;
    }

    const { data: urlData } = supabase.storage
      .from('snapshots')
      .getPublicUrl(fileName);

    return urlData?.publicUrl || null;
  } catch (err) {
    console.error('Snapshot upload failed:', err);
    toast.error('Unexpected error uploading preview');
    return null;
  }
}
