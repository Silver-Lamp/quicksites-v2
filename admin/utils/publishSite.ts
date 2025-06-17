import { supabase } from '@/admin/lib/supabaseClient';
import { uploadQRCodeImage } from './uploadQRCodeImage';

export async function publishSite({
  slug,
  snapshotId,
  profileId,
  versionLabel,
  isUpdateMode,
}: {
  slug: string;
  snapshotId: string;
  profileId: string;
  versionLabel: string;
  isUpdateMode: boolean;
}) {
  if (!slug || !profileId)
    throw new Error('Slug and branding profile are required.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
    throw new Error('Invalid slug format.');

  if (!isUpdateMode) {
    const { data: existing } = await supabase
      .from('published_sites')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (existing) throw new Error('Slug already exists.');
  }

  await supabase.from('published_versions').insert({
    label: versionLabel || `Version ${Date.now()}`,
    slug,
    snapshot_id: snapshotId,
    branding_profile_id: profileId,
    created_at: new Date().toISOString(),
  });

  const publishData = {
    slug,
    snapshot_id: snapshotId,
    branding_profile_id: profileId,
    status: 'published',
    published_at: new Date().toISOString(),
  };

  const operation = isUpdateMode
    ? supabase.from('published_sites').update(publishData).eq('slug', slug)
    : supabase.from('published_sites').insert([publishData]);

  const { error } = await operation;
  if (error) throw new Error(error.message);

  const url = `${window.location.origin}/sites/${slug}`;
  const qrUrl = await uploadQRCodeImage(slug, url);
  await supabase
    .from('published_sites')
    .update({ qr_url: qrUrl })
    .eq('slug', slug);

  return url;
}
