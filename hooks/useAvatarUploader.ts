'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient.js';

export function useAvatarUploader(userId: string) {
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const path = `avatars/${userId}.png`;
    const publicUrl = supabase.storage.from('avatars').getPublicUrl(path).data?.publicUrl;
    setAvatarUrl(publicUrl ?? null);
  }, [userId]);

  const upload = async (file: File) => {
    if (!file || !userId) return;
    setUploading(true);
    const path = `avatars/${userId}.png`;

    await supabase.storage.from('avatars').upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    });

    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    setAvatarUrl(data?.publicUrl ?? null);
    setUploading(false);
  };

  return { avatarUrl, uploading, upload };
}
