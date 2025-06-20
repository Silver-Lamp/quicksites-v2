import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

interface UseImageUploaderOptions {
  siteId: string;
  templateId: string;
  dbField: string;
  folder?: string;
  label?: string;
  initialUrl?: string;
  onChange?: (url: string | null) => void;
}

export function useImageUploader({
  siteId,
  templateId,
  dbField,
  folder = 'uploads',
  label,
  initialUrl,
  onChange,
}: UseImageUploaderOptions) {
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [uploading, setUploading] = useState(false);

  function sanitizeFilename(filename: string): string {
    const parts = filename.split('.');
    const ext = parts.pop(); // file extension
    const base = parts.join('-').replace(/\s+/g, '-');
    const timestamp = Date.now(); // or use dayjs() for formatted date
    return `${base}-${timestamp}.${ext}`.toLowerCase();
  }

  const uploadImage = async (file: File) => {
    if (!file) return;

    const cleanName = sanitizeFilename(file.name);
    const filePath = `${folder}/${siteId}/${cleanName}`;
    setUploading(true);
    setPreview(URL.createObjectURL(file));

    const { error: uploadError } = await supabase.storage
      .from('site-images')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicData } = supabase.storage.from('site-images').getPublicUrl(filePath);

    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) return;

    const { error: updateError } = await supabase
      .from('templates')
      .update({
        [dbField]: publicUrl,
        [`${dbField}_meta`]: {
          originalName: file.name,
          path: filePath,
          uploadedAt: new Date().toISOString(),
        },
      })
      .eq('id', templateId);

    if (updateError) {
      console.error('DB update error:', updateError.message);
    } else {
      setPreview(publicUrl);
      onChange?.(publicUrl);
    }

    setUploading(false);
  };

  const removeImage = async () => {
    if (!preview) return;

    const { data: bucketInfo } = supabase.storage.from('site-images').getPublicUrl('');
    const bucketUrl = bucketInfo?.publicUrl;
    const path = preview.replace(`${bucketUrl}/`, '');

    const { error: deleteError } = await supabase.storage.from('site-images').remove([path]);

    if (deleteError) {
      console.error('Storage delete error:', deleteError.message);
      return;
    }

    const { error: updateError } = await supabase
      .from('templates')
      .update({ [dbField]: null })
      .eq('id', templateId);

    if (updateError) {
      console.error('DB remove error:', updateError.message);
    } else {
      setPreview(null);
      onChange?.(null);
    }
  };

  return {
    preview,
    uploading,
    uploadImage,
    removeImage,
  };
}
