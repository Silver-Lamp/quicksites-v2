import { supabaseAdmin } from './clients';
import { STORAGE_BUCKET } from './env';

/** Upload preview dataURL → public URL */
export async function uploadDataUrlPNG(dataUrl: string, path: string): Promise<string | null> {
  try {
    const [, b64] = dataUrl.split(',');
    if (!b64) return null;
    const buffer = Buffer.from(b64, 'base64');
    const { error } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (error) throw error;
    const { data } = await supabaseAdmin.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.error('[seed] uploadDataUrlPNG error:', e);
    return null;
  }
}
