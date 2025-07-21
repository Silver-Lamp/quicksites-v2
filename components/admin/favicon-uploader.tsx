'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Label } from '@/components/ui/label';

export default function FaviconUploader({
  templateId,
  currentUrl,
  onUpload,
}: {
  templateId: string;
  currentUrl?: string;
  onUpload: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(currentUrl || '');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1 * 1024 * 1024) {
      alert('Favicon file must be less than 1MB.');
      return;
    }

    const ext = 'png';
    const path = `favicons/${templateId}/favicon.${ext}`;

    setUploading(true);

    const optimizedRes = await fetch('/api/favicon-optimize', {
      method: 'POST',
      body: file,
    });

    if (!optimizedRes.ok) {
      alert('Optimization failed.');
      setUploading(false);
      return;
    }

    const blob = await optimizedRes.blob();

    const { error } = await supabase.storage
      .from('public')
      .upload(path, blob, {
        contentType: 'image/png',
        upsert: true,
      });

    if (error) {
      alert('Upload failed.');
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from('public').getPublicUrl(path);
    setPreview(data.publicUrl);
    onUpload(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-2">
      <Label>Favicon (.png only)</Label>
      <input type="file" accept=".png" onChange={handleFileChange} disabled={uploading} />
      {preview && (
        <div className="mt-2">
          <Image src={preview} alt="Favicon Preview" width={48} height={48} />
        </div>
      )}
    </div>
  );
}
