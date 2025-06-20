'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/admin/lib/supabaseClient';

export default function TemplateImageGallery({ templateId }: { templateId: string }) {
  const [images, setImages] = useState<any[]>([]);

  useEffect(() => {
    if (!templateId) return;
    supabase
      .from('template_images')
      .select('*')
      .eq('template_id', templateId)
      .order('uploaded_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) console.error('Failed to fetch image history:', error);
        else setImages(data);
      });
  }, [templateId]);

  if (!images.length) return null;

  return (
    <div className="mt-4 space-y-2">
      <h3 className="text-sm font-semibold">Upload History</h3>
      <div className="grid grid-cols-2 gap-2">
        {images.map((img) => (
          <div key={img.id} className="relative">
            <img
              src={img.url}
              alt={img.original_name}
              className="rounded border max-h-32 object-contain"
            />
            <div className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded">
              {img.type}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
