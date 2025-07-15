// import { getSupabase } from '@/lib/supabase/server';
import { supabase } from '@/lib/supabase/client'; // ✅ browser-safe

import { v4 as uuid } from 'uuid';

/**
 * Uploads an image to Supabase Storage and returns a public URL.
 * @param file File object to upload
 * @param folderPath Folder path within the bucket, e.g. `template-123/hero`
 * @param maxSizeMB Maximum file size in megabytes (default: 5)
 */
export async function uploadToStorage(
  file: File,
  folderPath: string,
  maxSizeMB = 5
): Promise<string> {
  // ✅ 1. Validate type
  if (!file.type.startsWith('image/')) {
    throw new Error('Only image files are allowed.');
  }

  // ✅ 2. Validate size
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size must be under ${maxSizeMB}MB.`);
  }

  // ✅ 3. Build filename
  const ext = file.name.split('.').pop();
  const fileName = `${folderPath}/${uuid()}.${ext}`;

  // ✅ 4. Upload
  // const supabase = await getSupabase();
  const { error } = await supabase.storage
    .from('templates') // your bucket name
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (error) {
    console.error('Upload failed:', error.message);
    throw new Error('Upload failed');
  }

  // ✅ 5. Return public URL
  const { data } = supabase.storage.from('templates').getPublicUrl(fileName);
  return data.publicUrl;
}
