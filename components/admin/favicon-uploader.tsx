// components/admin/favicon-uploader.tsx
'use client';

import { useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';
import { Button } from '@/components/ui/button';

export default function FaviconUploader({
  templateId,
  currentUrl,
  onUpload,
  bucket = 'favicons',                           // ✅ default to favicons
  folder = `template-${templateId}`,            // optional folder prefix
}: {
  templateId: string;
  currentUrl?: string | null;
  onUpload: (url: string) => void;
  bucket?: string;
  folder?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function handleFile(file: File) {
    setBusy(true);
    try {
      const name = `${folder}/favicon-${Date.now()}.png`;
      const { error } = await supabase.storage
        .from(bucket)                                // ✅ uses favicons by default
        .upload(name, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/png',
        });
      if (error) throw error;

      const { data } = supabase.storage.from(bucket).getPublicUrl(name);
      onUpload(data.publicUrl);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="file"
        accept="image/png"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
      {currentUrl ? (
        <a href={currentUrl} target="_blank" className="text-xs underline">
          View current
        </a>
      ) : null}
      <Button size="sm" disabled className="opacity-50">Upload</Button>
    </div>
  );
}
